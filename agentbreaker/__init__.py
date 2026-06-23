"""
agentbreaker
Inline circuit breaker for LLM agents.
"""

from .circuit_breaker import CircuitBreaker, ToolCall, RunState

# Try importing langchain_adapter callback
try:
    from .langchain_adapter import LangChainCircuitBreakerCallback
except ImportError:
    class LangChainCircuitBreakerCallback:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "langchain-core is required to use LangChainCircuitBreakerCallback. "
                "Install it via: pip install agentbreaker[langchain]"
            )

# Try importing openai_adapter hook
try:
    from .openai_adapter import AgentBreakerRunHooks
except ImportError:
    class AgentBreakerRunHooks:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "openai-agents is required to use AgentBreakerRunHooks. "
                "Install it via: pip install agentbreaker[openai-agents]"
            )

__all__ = [
    "CircuitBreaker",
    "ToolCall",
    "RunState",
    "LangChainCircuitBreakerCallback",
    "AgentBreakerRunHooks",
]
