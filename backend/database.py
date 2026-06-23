"""
database.py
SQLite database setup and models.
Stores every agent run and its outcome.
"""

from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

import urllib.parse

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentbreaker.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AgentRun(Base):
    """
    Stores a single agent run — live or completed.
    Updated in real time as the agent executes.
    """
    __tablename__ = "agent_runs"

    run_id          = Column(String, primary_key=True, index=True)
    topic           = Column(String, nullable=False)
    status          = Column(String, default="running")  # running | tripped | completed | error
    is_tripped      = Column(Boolean, default=False)
    trip_reason     = Column(String, nullable=True)
    trip_message    = Column(String, nullable=True)
    is_hidden       = Column(Boolean, default=False)

    # Token + cost tracking
    total_input_tokens  = Column(Integer, default=0)
    total_output_tokens = Column(Integer, default=0)
    total_tokens        = Column(Integer, default=0)
    total_cost_usd      = Column(Float, default=0.0)

    # Iteration tracking
    iteration_count = Column(Integer, default=0)
    tool_calls      = Column(JSON, default=list)

    # Timing
    elapsed_seconds = Column(Float, default=0.0)
    started_at      = Column(DateTime, default=datetime.utcnow)
    ended_at        = Column(DateTime, nullable=True)

    # Config used for this run
    config = Column(JSON, default=dict)

    # Full iteration history for the timeline chart
    iterations = Column(JSON, default=list)


def get_db():
    """Dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup."""
    Base.metadata.create_all(bind=engine)