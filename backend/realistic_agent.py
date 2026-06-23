"""
realistic_agent.py
Real-world LangChain agent target for AgentBreaker v2.1.
Uses a real Wikipedia search tool and ChatGroq with the native callback handler.
"""

import os
import time
import urllib.request
import urllib.parse
import json
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from circuit_breaker import CircuitBreaker
from langchain_adapter import LangChainCircuitBreakerCallback

@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for the given query and return a summary snippet."""
    try:
        safe_query = urllib.parse.quote(query)
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={safe_query}&format=json"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'AgentBreaker/2.1 (contact@agentbreaker.com)'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            results = data.get("query", {}).get("search", [])
            if not results:
                return f"No results found on Wikipedia for '{query}'."
            # Extract first 3 snippets and clean HTML tags
            snippets = []
            for r in results[:3]:
                title = r.get("title", "")
                snippet = r.get("snippet", "").replace('<span class="searchmatch">', '').replace('</span>', '')
                snippets.append(f"{title}: {snippet}")
            return "\n".join(snippets)
    except Exception as e:
        return f"Error querying Wikipedia: {e}"

def run_realistic_agent(topic: str, breaker: CircuitBreaker):
    """
    Executes a real agent loop that makes actual LLM calls and live tool requests.
    """
    callback = LangChainCircuitBreakerCallback(breaker)
    
    # Initialize real Groq LLM client
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
        max_tokens=300,
        callbacks=[callback],
    )
    
    current_question = topic
    findings = []

    print(f"\n🤖 Real Agent started on topic: '{topic}'")
    
    while True:
        print(f"--- Iteration {breaker.state.iteration_count + 1} ---")
        print(f"  🔍 Searching: {current_question}")

        # Execute the tool using the callback context manager or direct invocation
        # By calling invoke on the tool with callbacks, LangChain fires the callback
        search_result = wikipedia_search.invoke(
            input={"query": current_question}, 
            config={"callbacks": [callback]}
        )
        
        messages = [
            SystemMessage(content=(
                "You are a research agent. You are given a search result. "
                "Summarize the key finding in one sentence. "
                "Then generate ONE deeper follow-up research question. "
                "If the topic has been fully answered, return NEXT_QUESTION: DONE. "
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

        # Parse LLM response
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

        if breaker.state.iteration_count >= 20:
            print("  🛑 Hard safety iteration ceiling reached (20). Exiting.")
            break

        time.sleep(1.0)
        current_question = next_question
