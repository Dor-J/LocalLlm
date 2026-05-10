import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utc_now
from app.db.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    conversation_mode: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="regular",
        server_default=text("'regular'"),
    )
    crew_template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scene_state_json: Mapped[dict] = mapped_column(
        "scene_state_json",
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=text("TIMEZONE('utc', NOW())"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        server_default=text("TIMEZONE('utc', NOW())"),
    )

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )
    image_assets = relationship(
        "ImageAsset",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ImageAsset.created_at",
    )
    orchestration_runs = relationship(
        "OrchestrationRun",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="OrchestrationRun.created_at",
    )
