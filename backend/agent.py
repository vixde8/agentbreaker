"""
agent.py
The runaway research agent — the villain in the demo.

v2.1: Updated to use LangChainCircuitBreakerCallback for native adapter
integration. The agent no longer manually calls breaker.record_llm_call()
— the callback handles all interception automatically via LangChain events.

Two agent modes:
  - run_agent_with_callback(): Uses LangChainCircuitBreakerCallback (preferred)
    Works with any real research agent built on LangChain.
  - run_agent(): Legacy direct-call mode (used internally by the API executor)
    Kept for backward compatibility with the dashboard backend.
"""

import os
import uuid
import time
from dotenv import load_dotenv, find_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from circuit_breaker import CircuitBreaker
from langchain_adapter import LangChainCircuitBreakerCallback

load_dotenv(find_dotenv())


def create_llm(callbacks=None):
    """Initialize the Groq LLM client."""
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
        max_tokens=300,
        callbacks=callbacks or [],
    )


def mock_search_tool(query: str) -> str:
    """
    Simulates a web search result.
    Returns direct facts for normal queries, but vague looping results for loop tests.
    """
    query_lower = query.lower()
    if "1 + 1" in query_lower or "1+1" in query_lower:
        return "Search results: 1 + 1 is equal to 2."
    elif "france" in query_lower or "paris" in query_lower:
        return "Search results: The capital of France is Paris. Paris has a population of approximately 2.1 million."
    elif "groq" in query_lower and "openai" in query_lower:
        return (
            "Search results: Groq costs $0.59/$0.79 per 1M tokens. "
            "OpenAI GPT-4o costs $5/$15 per 1M tokens. "
            "Anthropic Claude 3.5 Sonnet costs $3/$15 per 1M tokens."
        )
    elif "xyzcorp" in query_lower or "stock price" in query_lower:
        # Keeps loop detector testing functional
        return "Search results for XYZCorp stock: Price currently fluctuating. Please check again in real-time."
    
    return (
        f"Search results for '{query}': "
        f"Found several interesting angles. "
        f"Experts disagree on the core mechanisms. "
        f"Further research into subtopics A, B, and C is recommended. "
        f"No definitive conclusion available yet."
    )


# ── Mode 1: Native LangChain Callback (recommended for real agents) ───────────

def run_agent_with_callback(topic: str, breaker: CircuitBreaker):
    """
    Research agent using the LangChainCircuitBreakerCallback.

    This is the integration pattern you'd use with real research agents:
      - The callback attaches to the LLM
      - Token counting happens automatically via on_llm_end
      - Tool calls are recorded via on_tool_start / on_agent_action
      - No manual breaker.record_llm_call() calls needed in business logic

    For real agents (LangGraph, AgentExecutor, CrewAI), attach the callback
    to the AgentExecutor instead of the LLM for full event coverage.
    """
    callback = LangChainCircuitBreakerCallback(breaker)
    llm = create_llm(callbacks=[callback])

    current_question = topic
    findings = []

    print(f"\n🤖 Agent started (callback mode) on topic: '{topic}'")
    print(f"   Run ID: {breaker.state.run_id}")
    print(f"   Thresholds: {breaker.config.get('max_iterations')} iters | "
          f"${breaker.config.get('max_cost_usd')} budget\n")

    while True:
        print(f"--- Iteration {breaker.state.iteration_count + 1} ---")
        print(f"  🔍 Searching: {current_question}")

        # Record the tool call explicitly before calling the tool
        # This enables argument-aware loop detection
        breaker.record_tool_call(
            name="mock_search",
            args={"query": current_question},
        )
        search_result = mock_search_tool(current_question)

        messages = [
            SystemMessage(content=(
                "You are a research agent. You are given a search result. "
                "Summarize the key finding in one sentence. "
                "Then generate ONE deeper follow-up research question. "
                "Format your response exactly like this:\n"
                "FINDING: <one sentence summary>\n"
                "NEXT_QUESTION: <your follow-up question>"
            )),
            HumanMessage(content=(
                f"Current question: {current_question}\n"
                f"Search result: {search_result}\n"
                f"Previous findings: {findings[-3:] if findings else 'None'}"
            ))
        ]

        # The callback intercepts this call — no manual record_llm_call() needed
        # on_llm_end fires automatically and may raise RuntimeError to trip
        response = llm.invoke(messages)
        response_text = response.content

        # Parse the LLM response
        lines = response_text.strip().split("\n")
        finding = next(
            (l.replace("FINDING:", "").strip() for l in lines if l.startswith("FINDING:")),
            response_text
        )
        next_question = next(
            (l.replace("NEXT_QUESTION:", "").strip() for l in lines if l.startswith("NEXT_QUESTION:")),
            current_question
        )

        findings.append(finding)
        print(f"  📝 Finding: {finding}")
        print(f"  ➡️  Next: {next_question}")

        if "DONE" in next_question.upper():
            print("  🏁 Agent determined research is complete.")
            break

        time.sleep(0.3)
        current_question = next_question


# ── Mode 2: Legacy direct-call mode (used by the API executor) ────────────────

def run_agent(topic: str, breaker: CircuitBreaker):
    """
    Legacy agent mode — manually calls breaker.record_llm_call() each iteration.
    Used by the dashboard backend (main.py execute_run) which patches the method
    to persist state to the database after every call.

    Also updated to use record_tool_call() for proper argument-aware tracking.
    """
    llm = create_llm()
    current_question = topic
    findings = []

    print(f"\n🤖 Agent started on topic: '{topic}'")
    print(f"   Run ID: {breaker.state.run_id}")
    print(f"   Thresholds: max {breaker.config.get('max_iterations')} iterations | "
          f"${breaker.config.get('max_cost_usd')} max cost\n")

    while True:
        print(f"--- Iteration {breaker.state.iteration_count + 1} ---")
        print(f"  🔍 Searching: {current_question}")

        # Record tool call with args BEFORE executing — enables loop detection
        # even on the first trip (before record_llm_call increments iteration)
        breaker.record_tool_call(
            name="mock_search",
            args={"query": current_question},
        )
        search_result = mock_search_tool(current_question)

        messages = [
            SystemMessage(content=(
                "You are a research agent. You are given a search result. "
                "Summarize the key finding in one sentence. "
                "Then generate ONE deeper follow-up research question. "
                "Format your response exactly like this:\n"
                "FINDING: <one sentence summary>\n"
                "NEXT_QUESTION: <your follow-up question>"
            )),
            HumanMessage(content=(
                f"Current question: {current_question}\n"
                f"Search result: {search_result}\n"
                f"Previous findings: {findings[-3:] if findings else 'None'}"
            ))
        ]

        response = llm.invoke(messages)
        response_text = response.content

        usage = response.response_metadata.get("token_usage", {})
        input_tokens  = usage.get("prompt_tokens", 150)
        output_tokens = usage.get("completion_tokens", 80)

        lines = response_text.strip().split("\n")
        finding = next(
            (l.replace("FINDING:", "").strip() for l in lines if l.startswith("FINDING:")),
            response_text
        )
        next_question = next(
            (l.replace("NEXT_QUESTION:", "").strip() for l in lines if l.startswith("NEXT_QUESTION:")),
            current_question
        )

        findings.append(finding)
        print(f"  📝 Finding: {finding}")
        print(f"  ➡️  Next question: {next_question}")

        # Record LLM call — this is where the breaker evaluates and may trip
        breaker.record_llm_call(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        if "DONE" in next_question.upper():
            print("  🏁 Agent determined research is complete.")
            break

        time.sleep(0.5)
        current_question = next_question


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    """
    Demo entry point. Runs the callback-mode agent with the circuit breaker.
    """
    run_id = str(uuid.uuid4())[:8]
    config = {
        "max_iterations":       6,
        "max_cost_usd":         2.00,
        "max_time_seconds":     120.0,
        "max_velocity_per_10s": 0.50,
        "max_repeated_tool_calls": 4,
    }

    breaker = CircuitBreaker(run_id=run_id, config=config)

    try:
        run_agent_with_callback(
            topic="Why is artificial general intelligence difficult to achieve?",
            breaker=breaker,
        )
    except RuntimeError as e:
        print("\n📊 RUN SUMMARY")
        print("-" * 40)
        summary = breaker.get_summary()
        for key, value in summary.items():
            print(f"  {key}: {value}")
        print("-" * 40)
        print("\n✅ Agent stopped cleanly by circuit breaker.")


if __name__ == "__main__":
    main()