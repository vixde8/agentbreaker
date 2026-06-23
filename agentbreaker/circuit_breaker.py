"""
circuit_breaker.py
Core circuit breaker for AgentBreaker.
Tracks live run state and evaluates it against a configurable RuleEngine
after every LLM call. Trips and hard-stops the agent on a STOP violation.

v2.1 changes:
  - ToolCall dataclass stores name, args, timestamp, iteration
    (enables argument-aware stuck loop detection — no more false positives)
  - RunState.output_tokens_per_call tracks per-call output sizes
    (enables output bloat detection)
  - record_llm_call accepts optional tool_args dict
  - record_tool_call() — explicit method for frameworks that fire
    tool events separately (LangChain, OpenAI Agents SDK)
"""

import time
import hashlib
import json
from dataclasses import dataclass, field
from typing import Optional

from rules import RuleEngine, RuleViolation, Severity, build_default_engine


@dataclass
class ToolCall:
    """
    A single tool invocation captured during a run.
    args_fingerprint is a stable hash of the arguments dict so the
    argument-aware loop detector can compare calls without storing
    potentially huge argument payloads.
    """
    name: str
    args: dict
    timestamp: float
    iteration: int
    result: Optional[str] = None

    @property
    def args_fingerprint(self) -> str:
        """SHA-1 of the canonical JSON representation of args."""
        try:
            canonical = json.dumps(self.args, sort_keys=True, ensure_ascii=False)
        except (TypeError, ValueError):
            # Fallback for non-serializable args
            canonical = str(sorted(self.args.items()))
        return hashlib.sha1(canonical.encode()).hexdigest()[:12]

    def matches(self, other: "ToolCall") -> bool:
        """True if both name and arguments are identical."""
        return self.name == other.name and self.args_fingerprint == other.args_fingerprint


# ── Pricing constants (Groq Llama-3.3-70b) ───────────────────────────────────
INPUT_COST_PER_TOKEN  = 0.59 / 1_000_000   # $0.59 per 1M input tokens
OUTPUT_COST_PER_TOKEN = 0.79 / 1_000_000   # $0.79 per 1M output tokens
@dataclass
class RunState:
    """
    Live state of a single agent run.
    Updated after every LLM call and every tool call.
    Rules read from this.
    """
    run_id: str
    start_time: float = field(default_factory=time.time)

    # Aggregated token/cost metrics
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    iteration_count: int = 0

    # Per-call output token history — used by output_bloat rule
    output_tokens_per_call: list = field(default_factory=list)

    # Rich tool call history — includes args for argument-aware loop detection
    tool_calls: list = field(default_factory=list)  # list[ToolCall]

    # Trip state
    is_tripped: bool = False
    trip_reason: Optional[str] = None
    trip_message: str = ""
    warnings: list = field(default_factory=list)

    # Velocity tracking — stores (timestamp, cost) per LLM call
    cost_history: list = field(default_factory=list)


class CircuitBreaker:
    """
    Wraps every LLM call. Updates state, then runs the RuleEngine.
    Trips and raises RuntimeError the moment any STOP rule fires.
    """

    def __init__(self, run_id: str, config: dict = None,
                 rule_engine: RuleEngine = None):
        self.config = config or {}
        self.rule_engine = rule_engine or build_default_engine(self.config)
        self.state = RunState(run_id=run_id)

    # ── Public API ────────────────────────────────────────────────────────────

    def record_tool_call(self, name: str, args: dict = None):
        """
        Record a tool invocation. Call this before or after the tool runs.
        This enables argument-aware loop detection in the repeated_tool_calls rule.
        """
        tc = ToolCall(
            name=name,
            args=args or {},
            timestamp=time.time(),
            iteration=self.state.iteration_count,
        )
        self.state.tool_calls.append(tc)

    def record_tool_result(self, name: str, result: str):
        """
        Record the result of a tool execution for debugging and loop analysis.
        """
        state = self.state
        for tc in reversed(state.tool_calls):
            if tc.name == name and getattr(tc, "result", None) is None:
                tc.result = result
                print(f"  [Breaker] Recorded tool result for '{name}': {str(result)[:100]}...")
                break

    def record_llm_call(self, input_tokens: int, output_tokens: int,
                        tool_name: Optional[str] = None,
                        tool_args: Optional[dict] = None):
        """
        Call this after every LLM invocation.
        Updates state, then evaluates every active rule.
        Raises RuntimeError if any STOP-severity rule fires.
        """
        state = self.state

        # Update token counts
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens
        state.output_tokens_per_call.append(output_tokens)

        # Update cost
        call_cost = self._calculate_cost(input_tokens, output_tokens)
        state.total_cost_usd += call_cost
        state.cost_history.append((time.time(), call_cost))

        # Update iteration counter
        state.iteration_count += 1

        # Track tool call (backwards-compat path — prefer record_tool_call())
        if tool_name:
            self.record_tool_call(name=tool_name, args=tool_args or {})

        # Print live status to terminal
        print(
            f"  [Breaker] Iteration {state.iteration_count} | "
            f"Tokens: {state.total_input_tokens + state.total_output_tokens} | "
            f"Cost: ${state.total_cost_usd:.4f}"
        )

        # Evaluate all active rules — may raise RuntimeError
        self._evaluate_and_act()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * INPUT_COST_PER_TOKEN) + \
               (output_tokens * OUTPUT_COST_PER_TOKEN)

    def _evaluate_and_act(self):
        """Run the rule engine. Trip or warn based on result."""
        violation = self.rule_engine.evaluate(self.state)
        if violation is None:
            return

        if violation.severity == Severity.STOP:
            self._trip(violation)
        else:
            # WARN — log it, keep the agent running
            if violation.rule_id not in self.state.warnings:
                self.state.warnings.append(violation.rule_id)
                print(f"  ⚠️  [Warning] {violation.rule_name}: {violation.message}")

    def _trip(self, violation: RuleViolation):
        """Mark the run as tripped and raise to stop the agent."""
        state = self.state
        state.is_tripped = True
        state.trip_reason = violation.rule_id
        state.trip_message = violation.message

        print(f"\n🔴 CIRCUIT BREAKER TRIPPED")
        print(f"   Rule:     {violation.rule_name}")
        print(f"   Reason:   {violation.message}")
        print(f"   Cost:     ${state.total_cost_usd:.4f}")
        print(f"   Iters:    {state.iteration_count}")
        print(f"   Elapsed:  {time.time() - state.start_time:.1f}s\n")

        raise RuntimeError(
            f"CircuitBreaker tripped [{violation.rule_id}]: {violation.message}"
        )

    def get_summary(self) -> dict:
        """Return a full summary of the run. Used by the API and dashboard."""
        state = self.state
        elapsed = time.time() - state.start_time

        # Serialise tool_calls
        serialised_tool_calls = []
        for tc in state.tool_calls:
            if isinstance(tc, ToolCall):
                serialised_tool_calls.append({
                    "name": tc.name,
                    "args": tc.args,
                    "iteration": tc.iteration,
                    "timestamp": tc.timestamp,
                    "result": getattr(tc, "result", None)
                })
            else:
                serialised_tool_calls.append({"name": str(tc), "args": {}, "iteration": 0, "result": None})

        return {
            "run_id":              state.run_id,
            "is_tripped":          state.is_tripped,
            "trip_reason":         state.trip_reason,
            "trip_message":        state.trip_message,
            "warnings":            state.warnings,
            "total_input_tokens":  state.total_input_tokens,
            "total_output_tokens": state.total_output_tokens,
            "total_tokens":        state.total_input_tokens + state.total_output_tokens,
            "total_cost_usd":      round(state.total_cost_usd, 6),
            "iteration_count":     state.iteration_count,
            "tool_calls":          serialised_tool_calls,
            "elapsed_seconds":     round(elapsed, 2),
            "active_rules":        [r.id for r in self.rule_engine.rules],
        }