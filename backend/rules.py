"""
rules.py
Composable rule engine for AgentBreaker.
Replaces hardcoded thresholds with configurable, named rules.
Each rule inspects RunState and decides whether to trip the breaker.
"""

from dataclasses import dataclass
from typing import Callable, Optional
from enum import Enum


class Severity(Enum):
    """How serious a rule violation is."""
    WARN = "warn"    # Log it, don't stop the agent
    STOP = "stop"    # Trip the breaker, hard stop


@dataclass
class Rule:
    """
    A single named rule.
    `condition` receives the live RunState + RuleEngine config
    and returns True if the rule is violated.
    """
    id: str
    name: str
    description: str
    condition: Callable[["RunState", dict], bool]
    severity: Severity = Severity.STOP
    message_template: str = "{name} was violated"

    def message(self, state, config) -> str:
        """Build a human-readable message when this rule fires."""
        return self.message_template.format(
            name=self.name, state=state, config=config
        )


@dataclass
class RuleViolation:
    """Result of a rule firing."""
    rule_id: str
    rule_name: str
    severity: Severity
    message: str


class RuleEngine:
    """
    Holds an active set of rules and evaluates them against
    live run state after every LLM call.
    """

    def __init__(self, rules: list[Rule], config: dict):
        """
        rules:  list of Rule objects to evaluate, in order
        config: dict of thresholds these rules read from
                e.g. {"max_cost_usd": 2.0, "max_iterations": 10}
        """
        self.rules = rules
        self.config = config

    def evaluate(self, state) -> Optional[RuleViolation]:
        """
        Run every rule against current state.
        Returns the FIRST violation found (rules checked in order),
        or None if all rules pass.
        Warnings don't stop evaluation — only STOP severity returns early.
        """
        warnings = []

        for rule in self.rules:
            try:
                fired = rule.condition(state, self.config)
            except Exception:
                # A broken rule should never crash the agent
                continue

            if fired:
                violation = RuleViolation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    message=rule.message(state, self.config),
                )
                if rule.severity == Severity.STOP:
                    return violation
                warnings.append(violation)

        # No STOP fired — return first warning if any (caller can log it)
        return warnings[0] if warnings else None


# ─────────────────────────────────────────────────────────────────────────
# BUILT-IN RULE LIBRARY
# Companies pick and configure these. New rules get added here over time.
# ─────────────────────────────────────────────────────────────────────────

def _cost_exceeded(state, config) -> bool:
    return state.total_cost_usd >= config.get("max_cost_usd", 2.00)

def _iterations_exceeded(state, config) -> bool:
    return state.iteration_count >= config.get("max_iterations", 10)

def _time_exceeded(state, config) -> bool:
    import time
    elapsed = time.time() - state.start_time
    return elapsed >= config.get("max_time_seconds", 120.0)

def _velocity_exceeded(state, config) -> bool:
    import time
    window = config.get("velocity_window_seconds", 10.0)
    limit = config.get("max_velocity_per_10s", 0.50)
    now = time.time()
    recent_cost = sum(
        cost for ts, cost in state.cost_history if now - ts <= window
    )
    return recent_cost >= limit

def _repeated_tool_calls(state, config) -> bool:
    """Trips if the SAME tool was called N times in a row — sign of a stuck loop."""
    limit = config.get("max_repeated_tool_calls", 4)
    if len(state.tool_calls) < limit:
        return False
    last_n = state.tool_calls[-limit:]
    return len(set(last_n)) == 1  # all identical

def _cost_per_iteration_spike(state, config) -> bool:
    """Trips if a single iteration cost way more than the running average — anomaly."""
    multiplier = config.get("spike_multiplier", 5.0)
    if state.iteration_count < 3 or not state.cost_history:
        return False
    costs = [c for _, c in state.cost_history]
    avg = sum(costs[:-1]) / max(len(costs) - 1, 1)
    latest = costs[-1]
    return avg > 0 and latest >= avg * multiplier

def _no_progress_warning(state, config) -> bool:
    """WARN-level: flags long runs that haven't tripped anything else yet."""
    soft_iter_limit = config.get("warn_iterations", 4)
    return state.iteration_count == soft_iter_limit


BUILTIN_RULES: dict[str, Rule] = {

    "cost_exceeded": Rule(
        id="cost_exceeded",
        name="Total Cost Limit",
        description="Trips when cumulative cost exceeds the configured budget.",
        condition=_cost_exceeded,
        severity=Severity.STOP,
        message_template="Total cost exceeded budget limit",
    ),

    "iterations_exceeded": Rule(
        id="iterations_exceeded",
        name="Max Iterations",
        description="Trips when the agent makes too many LLM calls in one run.",
        condition=_iterations_exceeded,
        severity=Severity.STOP,
        message_template="Iteration count exceeded configured limit",
    ),

    "time_exceeded": Rule(
        id="time_exceeded",
        name="Max Run Time",
        description="Trips when total run time exceeds the configured ceiling.",
        condition=_time_exceeded,
        severity=Severity.STOP,
        message_template="Run time exceeded configured limit",
    ),

    "velocity_exceeded": Rule(
        id="velocity_exceeded",
        name="Spend Velocity",
        description="Trips when spend rate over a rolling window spikes — catches fast burns.",
        condition=_velocity_exceeded,
        severity=Severity.STOP,
        message_template="Spend velocity exceeded safe rate",
    ),

    "repeated_tool_calls": Rule(
        id="repeated_tool_calls",
        name="Stuck Loop Detector",
        description="Trips when the same tool is called repeatedly — agent is likely stuck.",
        condition=_repeated_tool_calls,
        severity=Severity.STOP,
        message_template="Same tool called repeatedly — agent appears stuck in a loop",
    ),

    "cost_spike": Rule(
        id="cost_spike",
        name="Cost Anomaly Spike",
        description="Trips when a single iteration costs far more than the running average.",
        condition=_cost_per_iteration_spike,
        severity=Severity.STOP,
        message_template="Single iteration cost spiked well above the run average",
    ),

    "no_progress_warning": Rule(
        id="no_progress_warning",
        name="Long Run Warning",
        description="Soft warning when a run is taking longer than expected — doesn't stop it.",
        condition=_no_progress_warning,
        severity=Severity.WARN,
        message_template="Run is taking longer than expected — flagged for review",
    ),
}


def build_default_engine(config: dict) -> RuleEngine:
    """
    Default rule set most companies will start with —
    the four original thresholds plus loop detection.
    """
    active = [
        BUILTIN_RULES["cost_exceeded"],
        BUILTIN_RULES["iterations_exceeded"],
        BUILTIN_RULES["time_exceeded"],
        BUILTIN_RULES["velocity_exceeded"],
        BUILTIN_RULES["repeated_tool_calls"],
    ]
    return RuleEngine(rules=active, config=config)


def build_engine_from_ids(rule_ids: list[str], config: dict) -> RuleEngine:
    """Build a custom engine from a list of rule IDs — used by the API."""
    active = [BUILTIN_RULES[rid] for rid in rule_ids if rid in BUILTIN_RULES]
    return RuleEngine(rules=active, config=config)