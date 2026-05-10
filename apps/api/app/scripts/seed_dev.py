import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionFactory
from app.models import ChatMessageRole, ChatSession
from app.repositories.chat_messages import ChatMessageRepository
from app.repositories.chat_sessions import ChatSessionRepository


async def seed() -> None:
    async with AsyncSessionFactory() as db_session:
        existing = await db_session.execute(select(ChatSession).limit(1))
        if existing.scalar_one_or_none() is not None:
            print("Seed skipped: chat sessions already exist.")
            return

        session_repository = ChatSessionRepository(db_session)
        message_repository = ChatMessageRepository(db_session)

        session = await session_repository.create_session(title="Starter conversation")
        await message_repository.create_message(
            session_id=session.id,
            role=ChatMessageRole.USER,
            content="What is this starter app wired for?",
            selected_model="qwen3.5:2b",
            metadata={"seed": True},
        )
        await message_repository.create_message(
            session_id=session.id,
            role=ChatMessageRole.ASSISTANT,
            content=(
                "It persists chats in PostgreSQL, stores embeddings in pgvector, "
                "and forwards chat completions to the local Ollama HTTP API."
            ),
            selected_model="qwen3.5:2b",
            metadata={"seed": True},
        )
        await session_repository.touch_session(session)
        await db_session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
