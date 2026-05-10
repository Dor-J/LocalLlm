import pytest

from app.services.llm.base import validate_selected_model


def test_validate_selected_model_accepts_exact_allowlist_members() -> None:
    result = validate_selected_model(
        "gemma4-e2b-uncensored-q5_k_p",
        (
            "qwen3.5:2b",
            "gemma4:e2b",
            "gemma4-e2b-uncensored-q5_k_p",
        ),
    )
    assert result == "gemma4-e2b-uncensored-q5_k_p"


def test_validate_selected_model_accepts_exact_allowlist_members_for_default() -> None:
    result = validate_selected_model(
        "qwen3.5:2b",
        (
            "qwen3.5:2b",
            "gemma4:e2b",
            "gemma4-e2b-uncensored-q5_k_p",
        ),
    )
    assert result == "qwen3.5:2b"


def test_validate_selected_model_accepts_gemma_member() -> None:
    result = validate_selected_model(
        "gemma4:e2b",
        (
            "qwen3.5:2b",
            "gemma4:e2b",
            "gemma4-e2b-uncensored-q5_k_p",
        ),
    )
    assert result == "gemma4:e2b"


def test_validate_selected_model_rejects_unknown_model() -> None:
    with pytest.raises(ValueError, match="Unsupported model"):
        validate_selected_model(
            "llama3",
            (
                "qwen3.5:2b",
                "gemma4:e2b",
                "gemma4-e2b-uncensored-q5_k_p",
            ),
        )
