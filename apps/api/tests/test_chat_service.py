from uuid import uuid4

import pytest

from app.services.chat_service import ChatService
from tests.fakes import (
    FakeAgentOrchestrator,
    FakeCrewAgentOrchestrator,
    FakeDBSession,
    FakeImageAssetService,
    FakeLLMProvider,
    FakeMessage,
    FakeMessageRepository,
    FakeSession,
    FakeSessionRepository,
    FakeStorageGuard,
)


ALLOWED_MODELS = (
    "qwen3.5:2b",
    "gemma4:e2b",
    "gemma4-e2b-uncensored-q5_k_p",
)


@pytest.mark.asyncio
async def test_generate_response_persists_user_and_assistant_messages() -> None:
    session = FakeSession(id=uuid4())
    session_repository = FakeSessionRepository(session)
    message_repository = FakeMessageRepository()
    llm_provider = FakeLLMProvider()
    db_session = FakeDBSession()
    storage_guard = FakeStorageGuard()
    image_asset_service = FakeImageAssetService()

    service = ChatService(
        session_repository=session_repository,
        message_repository=message_repository,
        llm_provider=llm_provider,
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=image_asset_service,
        storage_guard_service=storage_guard,
        allowed_models=ALLOWED_MODELS,
        db_session=db_session,
    )

    updated_session, user_message, assistant_message, orchestration = (
        await service.generate_response(
            session_id=session.id,
            content="Explain the architecture",
            selected_model="qwen3.5:2b",
            agent_mode=False,
        )
    )

    assert updated_session.title == "Explain the architecture"
    assert updated_session.conversation_mode == "regular"
    assert user_message.content == "Explain the architecture"
    assert user_message.message_metadata["conversation_mode"] == "regular"
    assert assistant_message.content == "Synthetic answer"
    assert assistant_message.selected_model == "qwen3.5:2b"
    assert llm_provider.calls[0]["model"] == "qwen3.5:2b"
    assert orchestration.mode == "none"
    assert db_session.commits == 0
    assert db_session.flushes == 2
    assert storage_guard.contexts == ["store_user_message", "store_assistant_message"]


@pytest.mark.asyncio
async def test_generate_response_includes_images_for_gemma() -> None:
    session = FakeSession(id=uuid4())
    session_repository = FakeSessionRepository(session)
    message_repository = FakeMessageRepository()
    llm_provider = FakeLLMProvider()
    db_session = FakeDBSession()
    storage_guard = FakeStorageGuard()
    image_asset_service = FakeImageAssetService()

    service = ChatService(
        session_repository=session_repository,
        message_repository=message_repository,
        llm_provider=llm_provider,
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=image_asset_service,
        storage_guard_service=storage_guard,
        allowed_models=ALLOWED_MODELS,
        db_session=db_session,
    )

    await service.generate_response(
        session_id=session.id,
        content="Analyze this screenshot",
        selected_model="gemma4:e2b",
        agent_mode=False,
        image_asset_ids=[uuid4()],
    )

    assert image_asset_service.loaded_image_requests
    assert llm_provider.calls[0]["messages"][-1].images == ["ZmFrZS1pbWFnZQ=="]


@pytest.mark.asyncio
async def test_generate_response_rejects_images_for_qwen() -> None:
    session = FakeSession(id=uuid4())
    service = ChatService(
        session_repository=FakeSessionRepository(session),
        message_repository=FakeMessageRepository(),
        llm_provider=FakeLLMProvider(),
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=FakeImageAssetService(),
        storage_guard_service=FakeStorageGuard(),
        allowed_models=ALLOWED_MODELS,
        db_session=FakeDBSession(),
    )

    with pytest.raises(ValueError, match="Image attachments are only supported"):
        await service.generate_response(
            session_id=session.id,
            content="hello",
            selected_model="qwen3.5:2b",
            agent_mode=False,
            image_asset_ids=[uuid4()],
        )


@pytest.mark.asyncio
async def test_generate_response_starts_new_context_when_switching_models() -> None:
    session = FakeSession(id=uuid4())
    message_repository = FakeMessageRepository()
    llm_provider = FakeLLMProvider()

    message_repository.messages = [
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="user",
            content="Old qwen prompt",
            selected_model="qwen3.5:2b",
        ),
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="assistant",
            content="Old qwen answer",
            selected_model="qwen3.5:2b",
        ),
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="user",
            content="Gemma model prompt",
            selected_model="gemma4:e2b",
        ),
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="assistant",
            content="Gemma model answer",
            selected_model="gemma4:e2b",
        ),
    ]

    service = ChatService(
        session_repository=FakeSessionRepository(session),
        message_repository=message_repository,
        llm_provider=llm_provider,
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=FakeImageAssetService(),
        storage_guard_service=FakeStorageGuard(),
        allowed_models=ALLOWED_MODELS,
        db_session=FakeDBSession(),
    )

    await service.generate_response(
        session_id=session.id,
        content="Back to qwen",
        selected_model="qwen3.5:2b",
        agent_mode=False,
    )

    sent_messages = llm_provider.calls[0]["messages"]

    assert [message.content for message in sent_messages] == ["Back to qwen"]


@pytest.mark.asyncio
async def test_generate_response_keeps_contiguous_history_for_same_model() -> None:
    session = FakeSession(id=uuid4())
    message_repository = FakeMessageRepository()
    llm_provider = FakeLLMProvider()

    message_repository.messages = [
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="user",
            content="Question one",
            selected_model="qwen3.5:2b",
        ),
        FakeMessage(
            id=uuid4(),
            session_id=session.id,
            role="assistant",
            content="Answer one",
            selected_model="qwen3.5:2b",
        ),
    ]

    service = ChatService(
        session_repository=FakeSessionRepository(session),
        message_repository=message_repository,
        llm_provider=llm_provider,
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=FakeImageAssetService(),
        storage_guard_service=FakeStorageGuard(),
        allowed_models=ALLOWED_MODELS,
        db_session=FakeDBSession(),
    )

    await service.generate_response(
        session_id=session.id,
        content="Question two",
        selected_model="qwen3.5:2b",
        agent_mode=False,
    )

    sent_messages = llm_provider.calls[0]["messages"]

    assert [message.content for message in sent_messages] == [
        "Question one",
        "Answer one",
        "Question two",
    ]


@pytest.mark.asyncio
async def test_create_session_persists_mode_and_template() -> None:
    session = FakeSession(id=uuid4())
    session_repository = FakeSessionRepository(session)
    service = ChatService(
        session_repository=session_repository,
        message_repository=FakeMessageRepository(),
        llm_provider=FakeLLMProvider(),
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=FakeImageAssetService(),
        storage_guard_service=FakeStorageGuard(),
        allowed_models=ALLOWED_MODELS,
        db_session=FakeDBSession(),
    )

    created = await service.create_session(
        title="Roleplay",
        conversation_mode="roleplay",
        crew_template_id="roleplay-debate",
    )

    assert created.conversation_mode == "roleplay"
    assert created.crew_template_id == "roleplay-debate"


@pytest.mark.asyncio
async def test_generate_response_uses_crew_turn_for_roleplay() -> None:
    session = FakeSession(
        id=uuid4(), conversation_mode="roleplay", crew_template_id="roleplay-fantasy"
    )
    session_repository = FakeSessionRepository(session)
    message_repository = FakeMessageRepository()
    llm_provider = FakeLLMProvider()
    db_session = FakeDBSession()
    storage_guard = FakeStorageGuard()
    image_asset_service = FakeImageAssetService()
    orchestrator = FakeCrewAgentOrchestrator()

    service = ChatService(
        session_repository=session_repository,
        message_repository=message_repository,
        llm_provider=llm_provider,
        agent_orchestration_service=orchestrator,
        image_asset_service=image_asset_service,
        storage_guard_service=storage_guard,
        allowed_models=ALLOWED_MODELS,
        db_session=db_session,
    )

    _, user_message, assistant_message, orchestration = await service.generate_response(
        session_id=session.id,
        content="Act out the next scene",
        selected_model="qwen3.5:2b",
        agent_mode=True,
        conversation_mode="roleplay",
        crew_template_id="roleplay-fantasy",
    )

    assert user_message.message_metadata["conversation_mode"] == "roleplay"
    assert assistant_message.content == "Crew orchestrated reply"
    assert assistant_message.message_metadata["orchestration"]["run_id"] == "run-crew-1"
    assert orchestration.enabled is True
    assert orchestration.mode == "crewai"
    assert llm_provider.calls == []
    assert orchestrator.turn_calls[0]["conversation_mode"] == "roleplay"


@pytest.mark.asyncio
async def test_generate_response_propagates_llm_failure_after_user_turn() -> None:
    """LLM errors are not swallowed; DB rollback is handled by request-scoped transaction."""

    class BoomLlm(FakeLLMProvider):
        async def complete_chat(self, *, model, messages):
            self.calls.append({"model": model, "messages": messages})
            raise RuntimeError("simulated LLM outage")

    session = FakeSession(id=uuid4())
    message_repository = FakeMessageRepository()
    db_session = FakeDBSession()

    service = ChatService(
        session_repository=FakeSessionRepository(session),
        message_repository=message_repository,
        llm_provider=BoomLlm(),
        agent_orchestration_service=FakeAgentOrchestrator(),
        image_asset_service=FakeImageAssetService(),
        storage_guard_service=FakeStorageGuard(),
        allowed_models=ALLOWED_MODELS,
        db_session=db_session,
    )

    with pytest.raises(RuntimeError, match="simulated LLM outage"):
        await service.generate_response(
            session_id=session.id,
            content="hello",
            selected_model="qwen3.5:2b",
            agent_mode=False,
        )

    assert db_session.commits == 0
    assert db_session.flushes >= 1
