"""
agent.py
The runaway research agent — the villain in the demo.
Without the circuit breaker this loops forever, burning tokens.
With the circuit breaker it gets hard-stopped at threshold.
"""

import os
import uuid
import time
from dotenv import load_dotenv, find_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from circuit_breaker import CircuitBreaker

load_dotenv(find_dotenv())

def create_llm():
    """Initialize the Groq LLM client."""
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
        max_tokens=300,  # Keep each response short so loops are fast
    )


def mock_search_tool(query: str) -> str:
    """
    Simulates a search tool result.
    In a real agent this would call Serper, Tavily, etc.
    Returns vague results that make the agent want to search more.
    """
    return (
        f"Search results for '{query}': "
        f"Found several interesting angles. "
        f"Experts disagree on the core mechanisms. "
        f"Further research into subtopics A, B, and C is recommended. "
        f"No definitive conclusion available yet."
    )


def run_agent(topic: str, breaker: CircuitBreaker):
    """
    The runaway research agent.
    Takes a topic, keeps searching and summarizing forever.
    Each iteration spawns a deeper sub-question.
    Dies only when the circuit breaker trips.

    Args:
        topic: The research topic to investigate
        breaker: The CircuitBreaker instance wrapping this run
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

        # Step 1: Mock search
        search_result = mock_search_tool(current_question)

        # Step 2: Ask LLM to summarize and generate next question
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

        # Make the LLM call
        response = llm.invoke(messages)
        response_text = response.content

        # Extract token usage from response metadata
        usage = response.response_metadata.get("token_usage", {})
        input_tokens = usage.get("prompt_tokens", 150)
        output_tokens = usage.get("completion_tokens", 80)

        # Parse response
        lines = response_text.strip().split("\n")
        finding = next((l.replace("FINDING:", "").strip()
                       for l in lines if l.startswith("FINDING:")), response_text)
        next_question = next((l.replace("NEXT_QUESTION:", "").strip()
                             for l in lines if l.startswith("NEXT_QUESTION:")), current_question)

        findings.append(finding)
        print(f"  📝 Finding: {finding}")
        print(f"  ➡️  Next question: {next_question}")

        # Record call with circuit breaker — this is where it can trip
        breaker.record_llm_call(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            tool_name="mock_search"
        )

        # Small delay so we can watch it in terminal
        time.sleep(0.5)

        # Loop continues with the new question
        current_question = next_question


def main():
    """
    Entry point. Runs the agent with the circuit breaker active.
    Change BreakerConfig values to see different trip behaviors.
    """
    run_id = str(uuid.uuid4())[:8]

# Config — plain dict of thresholds, trip after 6 iterations for a clean demo
    config = {
        "max_iterations": 6,
        "max_cost_usd": 2.00,
        "max_time_seconds": 120.0,
        "max_velocity_per_10s": 0.50,
    }

    breaker = CircuitBreaker(run_id=run_id, config=config)

    try:
        run_agent(
            topic="Why is artificial general intelligence difficult to achieve?",
            breaker=breaker
        )
    except RuntimeError as e:
        # Breaker tripped — print full summary
        print("\n📊 RUN SUMMARY")
        print("-" * 40)
        summary = breaker.get_summary()
        for key, value in summary.items():
            print(f"  {key}: {value}")
        print("-" * 40)
        print("\n✅ Agent stopped cleanly by circuit breaker.")


if __name__ == "__main__":
    main()