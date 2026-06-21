"""
circuit_breaker.py
Core circuit breaker for AgentBreaker.
Tracks live run state and evaluates it against a configurable RuleEngine
after every LLM call. Trips and hard-stops the agent on a STOP violation.
"""

import time
from dataclasses import dataclass, field
from typing import Optional

from rules import RuleEngine, RuleViolation, Severity, build_default_engine


@dataclass
class RunState:
    """
    Live state of a single agent run.
    Updated after every LLM call. Rules read from this.
    """
    run_id: str
    start_time: float = field(default_factory=time.time)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    iteration_count: int = 0
    tool_calls: list = field(default_factory=list)
    is_tripped: bool = False
    trip_reason: Optional[str] = None      # rule_id of the rule that fired
    trip_message: str = ""
    warnings: list = field(default_factory=list)  # rule_ids that warned

    # Velocity tracking — stores (timestamp, cost) per iteration
    cost_history: list = field(default_factory=list)


# Simulated Groq/Llama 3.3 pricing (for dashboard realism)
INPUT_COST_PER_TOKEN = 0.59 / 1_000_000   # $0.59 per 1M input tokens
OUTPUT_COST_PER_TOKEN = 0.79 / 1_000_000  # $0.79 per 1M output tokens


class CircuitBreaker:
    """
    Wraps every LLM call. Updates state, then runs the RuleEngine.
    Trips and raises RuntimeError the moment any STOP rule fires.
    """

    def __init__(self, run_id: str, config: dict = None,
                 rule_engine: RuleEngine = None):
        """
        run_id:      unique ID for this run
        config:      dict of thresholds, e.g. {"max_cost_usd": 2.0, ...}
                     used to build the default rule engine if none is given
        rule_engine: optional pre-built RuleEngine with a custom rule set.
                     If provided, `config` is ignored in favor of
                     rule_engine.config.
        """
        self.config = config or {}
        self.rule_engine = rule_engine or build_default_engine(self.config)
        self.state = RunState(run_id=run_id)

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate simulated USD cost from token counts."""
        return (input_tokens * INPUT_COST_PER_TOKEN) + \
               (output_tokens * OUTPUT_COST_PER_TOKEN)

    def record_llm_call(self, input_tokens: int, output_tokens: int,
                        tool_name: Optional[str] = None):
        """
        Call this after every LLM invocation.
        Updates state, then evaluates every active rule.
        Raises RuntimeError if any STOP-severity rule fires.
        """
        state = self.state

        # Update token counts
        state.total_input_tokens += input_tokens
        state.total_output_tokens += output_tokens

        # Update cost
        call_cost = self.calculate_cost(input_tokens, output_tokens)
        state.total_cost_usd += call_cost
        state.cost_history.append((time.time(), call_cost))

        # Update iterations
        state.iteration_count += 1

        # Track tool call if any
        if tool_name:
            state.tool_calls.append(tool_name)

        # Print live status to terminal
        print(f"  [Breaker] Iteration {state.iteration_count} | "
              f"Tokens: {state.total_input_tokens + state.total_output_tokens} | "
              f"Cost: ${state.total_cost_usd:.4f}")

        # Evaluate all active rules
        violation = self.rule_engine.evaluate(state)
        if violation is None:
            return

        if violation.severity == Severity.STOP:
            self._trip(violation)
        else:
            # WARN — log it, keep the agent running
            state.warnings.append(violation.rule_id)
            print(f"  ⚠️  [Warning] {violation.rule_name}: {violation.message}")

    def _trip(self, violation: RuleViolation):
        """Trip the breaker — mark state and raise to stop the agent."""
        state = self.state
        state.is_tripped = True
        state.trip_reason = violation.rule_id
        state.trip_message = violation.message

        print(f"\n🔴 CIRCUIT BREAKER TRIPPED")
        print(f"   Rule: {violation.rule_name}")
        print(f"   Reason: {violation.message}")
        print(f"   Total cost: ${state.total_cost_usd:.4f}")
        print(f"   Iterations: {state.iteration_count}")
        print(f"   Time elapsed: {time.time() - state.start_time:.1f}s\n")

        raise RuntimeError(f"CircuitBreaker tripped [{violation.rule_id}]: {violation.message}")

    def get_summary(self) -> dict:
        """Return a full summary of the run. Used by the API and dashboard."""
        state = self.state
        elapsed = time.time() - state.start_time
        return {
            "run_id": state.run_id,
            "is_tripped": state.is_tripped,
            "trip_reason": state.trip_reason,
            "trip_message": state.trip_message,
            "warnings": state.warnings,
            "total_input_tokens": state.total_input_tokens,
            "total_output_tokens": state.total_output_tokens,
            "total_tokens": state.total_input_tokens + state.total_output_tokens,
            "total_cost_usd": round(state.total_cost_usd, 6),
            "iteration_count": state.iteration_count,
            "tool_calls": state.tool_calls,
            "elapsed_seconds": round(elapsed, 2),
            "active_rules": [r.id for r in self.rule_engine.rules],
        }