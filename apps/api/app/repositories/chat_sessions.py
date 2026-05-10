import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.time import utc_now
from app.models import ChatSession


class ChatSessionRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def list_sessions(
        self,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[ChatSession], int]:
        count_stmt = select(func.count()).select_from(ChatSession)
        total = int(
            (await self.db_session.execute(count_stmt)).scalar_one(),
        )
        statement = (
            select(ChatSession)
            .order_by(ChatSession.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all()), total

    async def get_session_with_messages(self, session_id: uuid.UUID) -> ChatSession | None:
        """Load a session and its messages in a minimal number of ORM round trips."""
        result = await self.db_session.execute(
            select(ChatSession)
            .where(ChatSession.id == session_id)
            .options(selectinload(ChatSession.messages))
        )
        return result.scalars().one_or_none()

    async def create_session(
        self,
        *,
        title: str | None = None,
        conversation_mode: str = "regular",
        crew_template_id: str | None = None,
        scene_state_json: dict | None = None,
    ) -> ChatSession:
        session = ChatSession(
            title=title,
            conversation_mode=conversation_mode,
            crew_template_id=crew_template_id,
            scene_state_json=scene_state_json or {},
        )
        self.db_session.add(session)
        await self.db_session.flush()
        await self.db_session.refresh(session)
        return session

    async def count_sessions(self) -> int:
        statement = select(func.count()).select_from(ChatSession)
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def get_session(self, session_id: uuid.UUID) -> ChatSession | None:
        return await self.db_session.get(ChatSession, session_id)

    async def delete_session(self, session: ChatSession) -> None:
        await self.db_session.delete(session)

    async def touch_session(self, session: ChatSession) -> ChatSession:
        session.updated_at = utc_now()
        await self.db_session.flush()
        return session

    async def set_title_if_missing(self, session: ChatSession, *, title: str) -> ChatSession:
        if session.title:
            return session
        session.title = title
        session.updated_at = utc_now()
        await self.db_session.flush()
        return session
