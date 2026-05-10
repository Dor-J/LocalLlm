import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utc_now
from app.db.base import Base


class RoleplayTemplate(Base):
    __tablename__ = "roleplay_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    crew_template_id: Mapped[str] = mapped_column(String(64), nullable=False)
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

    roles = relationship(
        "RoleplayRole",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="RoleplayRole.sort_order",
    )
