# LangChain Integration

Install the package with the langchain extra:
```bash
pip install agentbreaker-sdk[langchain]
```

## Basic Usage

```python
from agentbreaker import LangChainCircuitBreakerCallback
from langchain_groq import ChatGroq

callback = LangChainCircuitBreakerCallback(
    run_id="my-run-001",
    config={
        "max_cost_usd": 0.50,
        "max_iterations": 10,
    }
)

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    callbacks=[callback]
)
```

Every LLM call through this client is now monitored. The breaker fires automatically when a rule is violated.
