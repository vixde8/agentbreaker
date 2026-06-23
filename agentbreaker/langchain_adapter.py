"""
langchain_adapter.py
LangChain callback handler for AgentBreaker.

Plugs AgentBreaker into any LangChain agent/chain with zero changes to the
agent's business logic — just add the callback when constructing the LLM or
the AgentExecutor.

Usage:
    from circuit_breaker import CircuitBreaker
    from langchain_adapter import LangChainCircuitBreakerCallback

    breaker  = CircuitBreaker(run_id="my-run", config={
        "max_iterations":    6,
        "max_cost_usd":      2.00,
        "max_time_seconds":  120,
        "max_velocity_per_10s": 0.5,
    })
    callback = LangChainCircuitBreakerCallback(breaker)

    # Option A — attach to the LLM (most portable)
    llm = ChatGroq(..., callbacks=[callback])

    # Option B — attach to AgentExecutor (also captures tool calls)
    agent_executor = AgentExecutor(agent=..., tools=..., callbacks=[callback])

    try:
        result = agent_executor.invoke({"input": "Research topic..."})
    except RuntimeError as e:
        # Circuit breaker tripped
        summary = breaker.get_summary()

Compatible frameworks (any that use LangChain callbacks):
    - LangChain AgentExecutor (ReAct, OpenAI Functions, Tool-calling agents)
    - LangGraph nodes that use ChatModel.invoke()
    - LangChain chains (LLMChain, RunnableSequence, etc.)
    - CrewAI (via LangChain LLM integration)
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

try:
    from langchain_core.callbacks import BaseCallbackHandler
    from langchain_core.outputs import LLMResult
    from langchain_core.agents import AgentAction, AgentFinish
except ImportError:
    raise ImportError(
        "langchain-core is required for LangChainCircuitBreakerCallback. "
        "Install it with: pip install langchain-core"
    )

from circuit_breaker import CircuitBreaker, ToolCall


class LangChainCircuitBreakerCallback(BaseCallbackHandler):
    """
    LangChain callback that connects the circuit breaker to any LangChain agent.

    Intercepts three event types:
      1. on_llm_end     — captures token usage after each LLM call
      2. on_tool_start  — records tool name and arguments before execution
      3. on_agent_action — records the agent's chosen tool (ReAct/OpenAI-tools)

    The token interception uses the LangChain standard token_usage metadata
    which is populated by:
      - ChatGroq (llm_output.token_usage)
      - ChatOpenAI (llm_output.token_usage)
      - ChatAnthropic (usage_metadata on the AIMessage)
      - Most other ChatModel implementations

    If a model doesn't provide token_usage, we fall back to a character-based
    estimate so the breaker still functions (just with less accurate cost data).
    """

    # Tell LangChain this callback should raise exceptions that stop the chain
    raise_error = True

    def __init__(self, breaker: CircuitBreaker):
        """
        Args:
            breaker: A configured CircuitBreaker instance.
                     The same instance should be reused to accumulate state
                     across the full run (not recreated per LLM call).
        """
        super().__init__()
        self.breaker = breaker
        # Track pending tool so on_llm_end can associate it if needed
        self._pending_tool_name: Optional[str] = None
        self._pending_tool_args: Optional[dict] = None

    # ── LLM events ────────────────────────────────────────────────────────────

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """
        Fired after every LLM call completes.
        Extracts token usage and records it in the circuit breaker.
        This is the primary hook that drives cost/iteration/velocity rules.
        """
        input_tokens, output_tokens = self._extract_tokens(response)

        # Associate pending tool call with this LLM iteration if recorded
        # (happens when ReAct agent picks a tool in this LLM call)
        tool_name = self._pending_tool_name
        tool_args = self._pending_tool_args
        self._pending_tool_name = None
        self._pending_tool_args = None

        # This may raise RuntimeError if a STOP rule fires
        self.breaker.record_llm_call(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            tool_name=tool_name,
            tool_args=tool_args,
        )

    def on_llm_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        **kwargs: Any,
    ) -> None:
        """
        Fired when an LLM call throws an exception.
        We still count this as an iteration so cost rules fire correctly
        on runaway agents that keep retrying failed calls.
        """
        # Use 0 tokens on error — still increments iteration_count
        self.breaker.record_llm_call(input_tokens=0, output_tokens=0)

    # ── Tool / Agent action events ─────────────────────────────────────────────

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        run_id: UUID = None,
        **kwargs: Any,
    ) -> None:
        """
        Fired before a tool executes. Captures tool name and input.
        We record this immediately so that the argument-aware loop detector
        can compare against previous calls even if the LLM hasn't finished.

        Note: tool args may arrive as a raw string (input_str) rather than
        a dict. We attempt to parse JSON, falling back to {"input": input_str}.
        """
        tool_name = serialized.get("name", "unknown_tool")
        tool_args = self._parse_tool_args(input_str)
        self.breaker.record_tool_call(name=tool_name, args=tool_args)

    def on_agent_action(
        self,
        action: AgentAction,
        run_id: UUID = None,
        **kwargs: Any,
    ) -> None:
        """
        Fired when a ReAct/tool-calling agent decides on its next action.
        Stash the tool info so on_llm_end can pair it with the right call.
        Also record it directly for frameworks that don't fire on_tool_start.
        """
        tool_args = self._parse_tool_args(action.tool_input)
        self._pending_tool_name = action.tool
        self._pending_tool_args = tool_args
        # Also record it immediately for completeness
        self.breaker.record_tool_call(name=action.tool, args=tool_args)

    def on_agent_finish(
        self,
        finish: AgentFinish,
        run_id: UUID = None,
        **kwargs: Any,
    ) -> None:
        """Agent completed cleanly — nothing to do but could log here."""
        pass

    def on_tool_end(
        self,
        output: str,
        run_id: UUID = None,
        **kwargs: Any,
    ) -> None:
        """Tool finished — output available. Record tool result in breaker."""
        name = kwargs.get("name")
        if not name and "serialized" in kwargs and isinstance(kwargs["serialized"], dict):
            name = kwargs["serialized"].get("name")
        
        # Fallback to the last recorded tool call if name is not explicitly passed
        if not name and self.breaker.state.tool_calls:
            name = self.breaker.state.tool_calls[-1].name
            
        if name:
            self.breaker.record_tool_result(name=name, result=str(output))

    def on_tool_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        run_id: UUID = None,
        **kwargs: Any,
    ) -> None:
        """Tool failed. We still track that it was called."""
        pass

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _extract_tokens(self, response: LLMResult) -> tuple[int, int]:
        """
        Extract (input_tokens, output_tokens) from an LLMResult.

        Tries multiple known metadata locations in priority order:
          1. llm_output["token_usage"]   — OpenAI, Groq, most providers
          2. generations[0][0].message.usage_metadata — Anthropic, newer APIs
          3. Character-count estimate    — fallback when no metadata available
        """
        # Path 1: llm_output dict (Groq, OpenAI, Cohere, etc.)
        if response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            if not usage:
                # Some providers nest it differently
                usage = response.llm_output.get("usage", {})
            if usage:
                input_t  = usage.get("prompt_tokens", 0) or usage.get("input_tokens", 0)
                output_t = usage.get("completion_tokens", 0) or usage.get("output_tokens", 0)
                if input_t or output_t:
                    return int(input_t), int(output_t)

        # Path 2: Anthropic / newer ChatModel usage_metadata on the generation
        try:
            gen = response.generations[0][0]
            if hasattr(gen, "message") and hasattr(gen.message, "usage_metadata"):
                meta = gen.message.usage_metadata
                input_t  = meta.get("input_tokens", 0)
                output_t = meta.get("output_tokens", 0)
                if input_t or output_t:
                    return int(input_t), int(output_t)
        except (IndexError, AttributeError, TypeError):
            pass

        # Path 3: Character-count estimate (≈4 chars per token)
        # Ensures breaker still works with models that don't report tokens
        try:
            total_chars = sum(
                len(gen.text)
                for gens in response.generations
                for gen in gens
                if hasattr(gen, "text") and gen.text
            )
            estimated = max(1, total_chars // 4)
            return estimated // 3, estimated  # rough 1:3 input:output split
        except Exception:
            return 0, 0

    @staticmethod
    def _parse_tool_args(raw: Any) -> dict:
        """
        Parse tool arguments into a dict for fingerprinting.

        LangChain delivers tool inputs in multiple formats depending on the
        agent type:
          - dict   — tool-calling agents (structured input)
          - str    — ReAct agents (JSON string or plain text)
          - other  — fallback to {"input": str(raw)}
        """
        if isinstance(raw, dict):
            return raw

        if isinstance(raw, str):
            import json
            stripped = raw.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, dict):
                        return parsed
                except (json.JSONDecodeError, ValueError):
                    pass
            return {"input": stripped}

        return {"input": str(raw)}
