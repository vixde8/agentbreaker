"""
openai_adapter.py
OpenAI Agents SDK adapter for AgentBreaker.
Uses import guards so the backend runs cleanly even if openai-agents is missing.
"""
import logging
from circuit_breaker import CircuitBreaker

logger = logging.getLogger("agentbreaker.openai_adapter")

try:
    from openai_agents import RunHooks
    HAS_OPENAI_AGENTS = True
except ImportError:
    RunHooks = object
    HAS_OPENAI_AGENTS = False


class AgentBreakerRunHooks(RunHooks):
    """
    Hook adapter for the OpenAI Agents SDK.
    Listens to LLM end events to record token consumption.
    """
    def __init__(self, breaker: CircuitBreaker):
        if not HAS_OPENAI_AGENTS:
            logger.warning("openai-agents is not installed; AgentBreakerRunHooks is a stub.")
        self.breaker = breaker

    def on_llm_end(self, run_context, response, **kwargs):
        """Called automatically after an LLM call completes in OpenAI Agents SDK."""
        if not hasattr(response, "usage") or response.usage is None:
            return

        usage = response.usage
        input_tokens = getattr(usage, "prompt_tokens", 0)
        output_tokens = getattr(usage, "completion_tokens", 0)

        # Record LLM call to circuit breaker
        self.breaker.record_llm_call(
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )
