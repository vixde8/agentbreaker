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


class CompareRun(Base):
    """
    Stores a comparison pair — one unguarded run + one guarded run.
    Created by POST /compare. Savings are computed when both runs finish.
    """
    __tablename__ = "compare_runs"

    compare_id          = Column(String, primary_key=True, index=True)
    topic               = Column(String, nullable=False)
    status              = Column(String, default="running")  # running | done | error
    unguarded_run_id    = Column(String, nullable=True)
    guarded_run_id      = Column(String, nullable=True)
    # Snapshot of final stats once done
    unguarded_iterations  = Column(Integer, default=0)
    unguarded_tokens      = Column(Integer, default=0)
    unguarded_cost_usd    = Column(Float, default=0.0)
    unguarded_status      = Column(String, nullable=True)
    guarded_iterations    = Column(Integer, default=0)
    guarded_tokens        = Column(Integer, default=0)
    guarded_cost_usd      = Column(Float, default=0.0)
    guarded_status        = Column(String, nullable=True)
    guarded_trip_reason   = Column(String, nullable=True)
    guarded_trip_message  = Column(String, nullable=True)
    cost_saved_pct        = Column(Float, default=0.0)
    tokens_saved          = Column(Integer, default=0)
    started_at            = Column(DateTime, default=datetime.utcnow)
    ended_at              = Column(DateTime, nullable=True)
    config                = Column(JSON, default=dict)


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