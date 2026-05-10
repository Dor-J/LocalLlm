from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.roleplay_templates import RoleplayTemplateRepository
from app.services.agent_orchestration.templates import get_template


class RoleplayTemplateService:
    def __init__(
        self,
        *,
        repository: RoleplayTemplateRepository,
        db_session: AsyncSession,
    ) -> None:
        self.repository = repository
        self.db_session = db_session

    async def list_templates(self):
        return await self.repository.list_templates()

    async def get_template(self, template_id: uuid.UUID):
        template = await self.repository.get_template(template_id)
        if template is None:
            raise ValueError("Roleplay template not found.")
        return template

    async def create_template(
        self,
        *,
        name: str,
        description: str | None,
        crew_template_id: str,
        scene_state_json: dict,
        roles: list[dict],
    ):
        self._validate_roleplay_crew_template(crew_template_id)
        template = await self.repository.create_template(
            name=name,
            description=description,
            crew_template_id=crew_template_id,
            scene_state_json=scene_state_json,
        )
        await self._replace_roles(template=template, roles=roles)
        return await self.get_template(template.id)

    async def update_template(
        self,
        *,
        template_id: uuid.UUID,
        name: str,
        description: str | None,
        crew_template_id: str,
        scene_state_json: dict,
        roles: list[dict],
    ):
        self._validate_roleplay_crew_template(crew_template_id)
        template = await self.get_template(template_id)
        template.name = name
        template.description = description
        template.crew_template_id = crew_template_id
        template.scene_state_json = scene_state_json

        existing_roles = {role.id: role for role in template.roles}
        seen_role_ids: set[uuid.UUID] = set()
        for sort_order, role_payload in enumerate(roles):
            role_id = role_payload.get("id")
            if role_id is not None and role_id in existing_roles:
                role = existing_roles[role_id]
                role.name = role_payload["name"]
                role.description = role_payload.get("description")
                role.system_prompt = role_payload["system_prompt"]
                role.sort_order = sort_order
                seen_role_ids.add(role_id)
                continue

            await self.repository.create_role(
                template=template,
                name=role_payload["name"],
                description=role_payload.get("description"),
                system_prompt=role_payload["system_prompt"],
                sort_order=sort_order,
            )

        for role_id, role in existing_roles.items():
            if role_id not in seen_role_ids:
                await self.repository.delete_role(role)

        return await self.get_template(template_id)

    async def delete_template(self, template_id: uuid.UUID) -> None:
        template = await self.get_template(template_id)
        await self.repository.delete_template(template)

    async def _replace_roles(self, *, template, roles: list[dict]) -> None:
        for sort_order, role_payload in enumerate(roles):
            await self.repository.create_role(
                template=template,
                name=role_payload["name"],
                description=role_payload.get("description"),
                system_prompt=role_payload["system_prompt"],
                sort_order=sort_order,
            )

    def _validate_roleplay_crew_template(self, crew_template_id: str) -> None:
        template = get_template(crew_template_id)
        if template.conversation_mode != "roleplay":
            raise ValueError("Roleplay templates must use a roleplay crew template.")
