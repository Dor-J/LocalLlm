from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import RoleplayRole, RoleplayTemplate


class RoleplayTemplateRepository:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

    async def list_templates(self) -> list[RoleplayTemplate]:
        statement = (
            select(RoleplayTemplate)
            .options(selectinload(RoleplayTemplate.roles))
            .order_by(RoleplayTemplate.updated_at.desc(), RoleplayTemplate.created_at.desc())
        )
        result = await self.db_session.execute(statement)
        return list(result.scalars().all())

    async def get_template(self, template_id: uuid.UUID) -> RoleplayTemplate | None:
        statement = (
            select(RoleplayTemplate)
            .options(selectinload(RoleplayTemplate.roles))
            .where(RoleplayTemplate.id == template_id)
        )
        result = await self.db_session.execute(statement)
        return result.scalar_one_or_none()

    async def create_template(
        self,
        *,
        name: str,
        description: str | None,
        crew_template_id: str,
        scene_state_json: dict,
    ) -> RoleplayTemplate:
        template = RoleplayTemplate(
            name=name,
            description=description,
            crew_template_id=crew_template_id,
            scene_state_json=scene_state_json,
        )
        self.db_session.add(template)
        await self.db_session.flush()
        await self.db_session.refresh(template)
        return template

    async def create_role(
        self,
        *,
        template: RoleplayTemplate,
        name: str,
        description: str | None,
        system_prompt: str,
        sort_order: int,
    ) -> RoleplayRole:
        role = RoleplayRole(
            template_id=template.id,
            name=name,
            description=description,
            system_prompt=system_prompt,
            sort_order=sort_order,
        )
        self.db_session.add(role)
        await self.db_session.flush()
        return role

    async def delete_template(self, template: RoleplayTemplate) -> None:
        await self.db_session.delete(template)

    async def delete_role(self, role: RoleplayRole) -> None:
        await self.db_session.delete(role)
