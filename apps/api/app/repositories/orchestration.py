from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.time import utc_now
from app.models import OrchestrationRun, OrchestrationStep


class OrchestrationRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def create_run(
        self,
        *,
        session_id: uuid.UUID,
        trigger_message_id: uuid.UUID | None,
        backend: str,
        conversation_mode: str,
        crew_template_id: str | None,
        prompt: str,
        metadata: dict | None = None,
    ) -> OrchestrationRun:
        run = OrchestrationRun(
            session_id=session_id,
            trigger_message_id=trigger_message_id,
            backend=backend,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            status="running",
            prompt=prompt,
            metadata_json=metadata or {},
        )
        self.db_session.add(run)
        await self.db_session.flush()
        await self.db_session.refresh(run)
        return run

    async def mark_run_completed(
        self,
        run: OrchestrationRun,
        *,
        status: str = "completed",
        metadata: dict | None = None,
        completed_at: datetime | None = None,
    ) -> OrchestrationRun:
        run.status = status
        if metadata is not None:
            run.metadata_json = metadata
        run.completed_at = completed_at or utc_now()
        await self.db_session.flush()
        return run

    async def create_step(
        self,
        *,
        run_id: uuid.UUID,
        step_index: int,
        role: str,
        status: str,
        input_text: str | None = None,
        output_text: str | None = None,
        metadata: dict | None = None,
    ) -> OrchestrationStep:
        step = OrchestrationStep(
            run_id=run_id,
            step_index=step_index,
            role=role,
            status=status,
            input_text=input_text,
            output_text=output_text,
            step_metadata=metadata or {},
        )
        self.db_session.add(step)
        await self.db_session.flush()
        await self.db_session.refresh(step)
        return step

    async def list_runs_for_session(self, session_id: uuid.UUID) -> list[OrchestrationRun]:
        statement = (
            select(OrchestrationRun)
            .options(selectinload(OrchestrationRun.steps))
            .where(OrchestrationRun.session_id == session_id)
            .order_by(OrchestrationRun.created_at.desc())
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def get_run(self, run_id: uuid.UUID) -> OrchestrationRun | None:
        statement = (
            select(OrchestrationRun)
            .options(selectinload(OrchestrationRun.steps))
            .where(OrchestrationRun.id == run_id)
        )
        result = await self.db_session.execute(statement)
        return result.scalar_one_or_none()

    async def list_steps_for_run(self, run_id: uuid.UUID) -> list[OrchestrationStep]:
        statement = (
            select(OrchestrationStep)
            .where(OrchestrationStep.run_id == run_id)
            .order_by(OrchestrationStep.step_index.asc())
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())
