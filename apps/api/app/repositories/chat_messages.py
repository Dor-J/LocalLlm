import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChatMessage, ChatMessageRole


class ChatMessageRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def list_by_session(self, session_id: uuid.UUID) -> list[ChatMessage]:
        statement = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def list_by_session_paginated(
        self,
        session_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[ChatMessage], int]:
        count_stmt = (
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.session_id == session_id)
        )
        total = int((await self.db_session.execute(count_stmt)).scalar_one())
        statement = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all()), total

    async def create_message(
        self,
        *,
        session_id: uuid.UUID,
        role: ChatMessageRole,
        content: str,
        selected_model: str | None,
        metadata: dict | None = None,
    ) -> ChatMessage:
        message = ChatMessage(
            session_id=session_id,
            role=role.value,
            content=content,
            selected_model=selected_model,
            message_metadata=metadata or {},
        )
        self.db_session.add(message)
        await self.db_session.flush()
        await self.db_session.refresh(message)
        return message

    async def count_by_session(self, session_id: uuid.UUID) -> int:
        statement = (
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.session_id == session_id)
        )
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())

    async def count_all_messages(self) -> int:
        statement = select(func.count()).select_from(ChatMessage)
        result = await self.db_session.execute(statement)
        return int(result.scalar_one())
