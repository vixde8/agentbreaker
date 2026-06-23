"""
scenarios.py
Defines scenario queries and expected outcomes, along with a Mock LLM implementation
to execute verification runs deterministically and without hitting API rate limits.
"""

class MockLLMResponse:
    def __init__(self, content: str, input_tokens: int = 150, output_tokens: int = 80):
        self.content = content
        self.response_metadata = {
            "token_usage": {
                "prompt_tokens": input_tokens,
                "completion_tokens": output_tokens
            }
        }

# Defined mock responses by scenario and iteration (0-indexed)
SCENARIO_MOCKS = {
    "simple_info": [
        # Iteration 0
        MockLLMResponse(
            content="FINDING: The capital of France is Paris.\nNEXT_QUESTION: What is the current population of Paris?",
            input_tokens=120,
            output_tokens=50
        ),
        # Iteration 1
        MockLLMResponse(
            content="FINDING: The population of Paris is approximately 2.1 million.\nNEXT_QUESTION: DONE",
            input_tokens=150,
            output_tokens=60
        )
    ],
    "deep_research": [
        # Iteration 0
        MockLLMResponse(
            content="FINDING: Groq llama-3.3-70b-versatile costs $0.59 per 1M input tokens and $0.79 per 1M output tokens.\nNEXT_QUESTION: What is the pricing of OpenAI GPT-4o?",
            input_tokens=180,
            output_tokens=70
        ),
        # Iteration 1
        MockLLMResponse(
            content="FINDING: OpenAI GPT-4o costs $5.00 per 1M input tokens and $15.00 per 1M output tokens.\nNEXT_QUESTION: What is the pricing of Anthropic Claude 3.5 Sonnet?",
            input_tokens=210,
            output_tokens=75
        ),
        # Iteration 2
        MockLLMResponse(
            content="FINDING: Anthropic Claude 3.5 Sonnet costs $3.00 per 1M input and $15.00 per 1M output tokens.\nNEXT_QUESTION: What are the context limits for these models?",
            input_tokens=240,
            output_tokens=80
        ),
        # Iteration 3
        MockLLMResponse(
            content="FINDING: Groq has a 128k context, OpenAI GPT-4o has 128k, and Claude 3.5 Sonnet has 200k.\nNEXT_QUESTION: DONE",
            input_tokens=260,
            output_tokens=65
        )
    ],
    "infinite_loop": [
        # Iterations 0-10: always ask the exact same question, causing repeated_tool_calls to fire
        MockLLMResponse(
            content="FINDING: XYZCorp stock price is currently $150.00.\nNEXT_QUESTION: Check stock price of XYZCorp again to see if it changes in real-time.",
            input_tokens=150,
            output_tokens=80
        )
    ],
    "canary_research": [
        # Iteration 0
        MockLLMResponse(
            content="FINDING: Next.js latest release is v14, offering Server Components and App Router.\nNEXT_QUESTION: What are the latest features and releases for Vite?",
            input_tokens=150,
            output_tokens=70
        ),
        # Iteration 1
        MockLLMResponse(
            content="FINDING: Vite latest version is v5, focusing on performance, rolldown, and SSR improvements.\nNEXT_QUESTION: What are the latest features and releases for Remix?",
            input_tokens=170,
            output_tokens=75
        ),
        # Iteration 2
        MockLLMResponse(
            content="FINDING: Remix version v2 focuses on Vite integration, stable React Router features, and streaming.\nNEXT_QUESTION: What is the development activity (commits/stars) for Next.js?",
            input_tokens=190,
            output_tokens=80
        ),
        # Iteration 3
        MockLLMResponse(
            content="FINDING: Next.js has highly active development on GitHub with 120k+ stars and frequent releases.\nNEXT_QUESTION: What is the development activity (commits/stars) for Vite?",
            input_tokens=210,
            output_tokens=85
        ),
        # Iteration 4
        MockLLMResponse(
            content="FINDING: Vite is extremely popular with 60k+ stars and very high community contributions.\nNEXT_QUESTION: What is the development activity (commits/stars) for Remix?",
            input_tokens=230,
            output_tokens=80
        ),
        # Iteration 5
        MockLLMResponse(
            content="FINDING: Remix has steady growth and development, now part of Shopify.\nNEXT_QUESTION: DONE",
            input_tokens=250,
            output_tokens=65
        )
    ]
}

SCENARIOS = {
    "simple_info": {
        "topic": "Find the capital of France and its current population",
        "expected_status": "completed",
        "desc": "Resolves in 2 iterations; verifies no false positives on short successful runs."
    },
    "deep_research": {
        "topic": "Analyze the differences in token pricing and context limits between Groq, OpenAI, and Anthropic models",
        "expected_status": "completed",
        "desc": "Performs progressive research; verifies normal execution is allowed up to iteration limits."
    },
    "infinite_loop": {
        "topic": "Search for the latest stock price of XYZCorp and repeatedly check if it changes in real-time",
        "expected_status": "tripped",
        "desc": "Repeatedly calls the exact same tool and args; verifies loop trip detection at iteration 4."
    },
    "canary_research": {
        "topic": "Compare the latest features, releases, and development activity of Next.js, Vite, and Remix frameworks",
        "expected_status": "completed",
        "desc": "Canary Scenario: legitimate deep research using same tool but different args for 6 iterations. Verifies no false positives."
    }
}
