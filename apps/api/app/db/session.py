from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from time import monotonic

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.perf import add_db_time_seconds

settings = get_settings()

_db_logger = logging.getLogger("app.db")

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_recycle=settings.database_pool_recycle,
    pool_timeout=settings.database_pool_timeout,
)
AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(
    conn, cursor, statement, parameters, context, executemany
) -> None:  # noqa: ARG001
    conn.info["_cursor_started_at"] = monotonic()


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(
    conn, cursor, statement, parameters, context, executemany
) -> None:  # noqa: ARG001
    started = conn.info.pop("_cursor_started_at", None)
    if started is None:
        return
    elapsed = monotonic() - started
    add_db_time_seconds(elapsed)
    ms = elapsed * 1000.0
    if ms >= get_settings().db_slow_query_log_ms:
        preview = (statement or "")[:500]
        if isinstance(parameters, (list, dict)) and len(str(parameters)) > 400:
            params = str(parameters)[:400] + "…"
        else:
            params = str(parameters) if parameters is not None else ""
        _db_logger.warning(
            "db_slow_query",
            extra={
                "db_statement_ms": round(ms, 2),
                "statement_preview": preview,
                "parameters_preview": params,
            },
        )


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            yield session
