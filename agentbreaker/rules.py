"""
rules.py
Composable rule engine for AgentBreaker.
Replaces hardcoded thresholds with configurable, named rules.
Each rule inspects RunState and decides whether to trip the breaker.

v2.1 changes:
  - repeated_tool_calls upgraded to argument-aware loop detection.
    Checks both tool name AND argument fingerprint so an agent legitimately
    calling search("query A") then search("query B") does NOT trigger a trip.
  - circling_loop (WARN) — same tool, slightly different args many times.
  - output_bloat (WARN) — single LLM response exceeds token threshold.
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
        self.rules = rules
        self.config = config

    def evaluate(self, state) -> Optional[RuleViolation]:
        """
        Run every rule against current state.
        STOP rules return immediately on first match.
        WARN rules are collected; first is returned only if no STOP fired.
        """
        warnings = []

        for rule in self.rules:
            try:
                fired = rule.condition(state, self.config)
            except Exception:
                # A broken rule must never crash the agent
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

        return warnings[0] if warnings else None


# ─────────────────────────────────────────────────────────────────────────────
# BUILT-IN RULE LIBRARY
# ─────────────────────────────────────────────────────────────────────────────

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
    limit  = config.get("max_velocity_per_10s", 0.50)
    now    = time.time()
    recent_cost = sum(
        cost for ts, cost in state.cost_history if now - ts <= window
    )
    return recent_cost >= limit


def _repeated_tool_calls(state, config) -> bool:
    """
    STOP — Argument-aware stuck loop detector.

    Trips only when the SAME tool is called with IDENTICAL arguments N times
    in a row. An agent that legitimately paginates or changes its query will
    NOT trigger this — the argument fingerprint will differ each time.

    Real-agent false-positive scenarios this fixes:
      - search("AGI definition") → search("AGI limitations") → ...  ✅ PASS
      - search("AGI definition") × 4 in a row                       🔴 TRIP
    """
    limit = config.get("max_repeated_tool_calls", 4)
    tool_calls = state.tool_calls

    if len(tool_calls) < limit:
        return False

    recent = tool_calls[-limit:]

    # Support both legacy string entries and new ToolCall objects
    def _key(tc):
        if hasattr(tc, "args_fingerprint"):
            return (tc.name, tc.args_fingerprint)
        return (str(tc), "")

    first_key = _key(recent[0])
    return all(_key(tc) == first_key for tc in recent[1:])


def _circling_loop(state, config) -> bool:
    """
    WARN — Circling loop detector.

    Warns when the SAME tool is called many times even with different args.
    This catches agents that are searching in circles rather than converging.
    Does NOT stop the agent — just flags it for review.

    Example: search("X"), search("Y"), search("Z"), search("W"), search("V")
    — all different queries, but if it's always the same tool it may be looping.
    """
    limit = config.get("max_same_tool_calls", 8)
    tool_calls = state.tool_calls

    if len(tool_calls) < limit:
        return False

    recent = tool_calls[-limit:]

    def _name(tc):
        return tc.name if hasattr(tc, "name") else str(tc)

    first_name = _name(recent[0])
    return all(_name(tc) == first_name for tc in recent[1:])


def _cost_per_iteration_spike(state, config) -> bool:
    """STOP — Trips if a single iteration costs way more than the running average."""
    multiplier = config.get("spike_multiplier", 5.0)
    if state.iteration_count < 3 or not state.cost_history:
        return False
    costs  = [c for _, c in state.cost_history]
    avg    = sum(costs[:-1]) / max(len(costs) - 1, 1)
    latest = costs[-1]
    return avg > 0 and latest >= avg * multiplier


def _output_bloat(state, config) -> bool:
    """
    WARN — Output bloat detector.

    Flags when a single LLM response exceeds the per-call output token threshold.
    Catches agents that return long essays when they should give concise answers.
    Does NOT stop the agent — but repeated bloat may trigger other STOP rules.

    Configure with: output_bloat_detection=True, max_output_tokens_per_call=300
    """
    if not config.get("output_bloat_detection", False):
        return False

    max_tokens = config.get("max_output_tokens_per_call", 300)
    per_call   = getattr(state, "output_tokens_per_call", [])
    if not per_call:
        return False

    return per_call[-1] > max_tokens


def _no_progress_warning(state, config) -> bool:
    """WARN — Flags long runs that haven't tripped anything else yet."""
    soft_iter_limit = config.get("warn_iterations", 4)
    return state.iteration_count == soft_iter_limit


# ─────────────────────────────────────────────────────────────────────────────
# RULE REGISTRY
# ─────────────────────────────────────────────────────────────────────────────

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
        description=(
            "Trips when the same tool is called with IDENTICAL arguments N times "
            "in a row. Argument-aware: different queries on the same tool do not trip."
        ),
        condition=_repeated_tool_calls,
        severity=Severity.STOP,
        message_template="Agent stuck — same tool+args called repeatedly with no progress",
    ),

    "circling_loop": Rule(
        id="circling_loop",
        name="Circling Loop Warning",
        description=(
            "Warns when the same tool dominates the run even with different arguments — "
            "the agent may be searching in circles without converging."
        ),
        condition=_circling_loop,
        severity=Severity.WARN,
        message_template="Agent may be circling — same tool called many times",
    ),

    "cost_spike": Rule(
        id="cost_spike",
        name="Cost Anomaly Spike",
        description="Trips when a single iteration costs far more than the running average.",
        condition=_cost_per_iteration_spike,
        severity=Severity.STOP,
        message_template="Single iteration cost spiked well above the run average",
    ),

    "output_bloat": Rule(
        id="output_bloat",
        name="Output Bloat Warning",
        description=(
            "Warns when a single LLM response exceeds the per-call output token threshold. "
            "Enable with output_bloat_detection=True in config."
        ),
        condition=_output_bloat,
        severity=Severity.WARN,
        message_template="LLM response is unusually long — possible output bloat",
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


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_default_engine(config: dict) -> RuleEngine:
    """
    Default rule set for most use cases.
    Includes the argument-aware stuck loop detector.
    """
    active = [
        BUILTIN_RULES["cost_exceeded"],
        BUILTIN_RULES["iterations_exceeded"],
        BUILTIN_RULES["time_exceeded"],
        BUILTIN_RULES["velocity_exceeded"],
        BUILTIN_RULES["repeated_tool_calls"],
        BUILTIN_RULES["circling_loop"],
    ]
    return RuleEngine(rules=active, config=config)


def build_engine_from_ids(rule_ids: list[str], config: dict) -> RuleEngine:
    """Build a custom engine from a list of rule IDs — used by the API."""
    active = [BUILTIN_RULES[rid] for rid in rule_ids if rid in BUILTIN_RULES]
    return RuleEngine(rules=active, config=config)