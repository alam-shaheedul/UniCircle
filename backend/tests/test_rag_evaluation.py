"""Deterministic quality gates for the CUET-specific RAG evaluation corpus."""

import json
from pathlib import Path
from urllib.parse import urlsplit

from app.modules.assistant.policy import SourcePolicy

DATASET = Path(__file__).parent / "fixtures" / "rag_evaluation.json"


def load_cases() -> list[dict]:
    return json.loads(DATASET.read_text(encoding="utf-8"))


def test_rag_evaluation_dataset_is_complete_and_cuet_scoped():
    cases = load_cases()
    assert len(cases) >= 6
    assert any(not item["answer_possible"] for item in cases)
    assert any(item["freshness"] == "refresh-required" for item in cases)
    policy = SourcePolicy(("cuet.ac.bd",))
    for item in cases:
        assert item["question"].strip()
        assert item["freshness"] in {"stable", "refresh-required", "unsupported"}
        if item["answer_possible"]:
            assert item["expected_key_facts"]
            assert policy.canonicalize(item["expected_source"])
            assert urlsplit(item["expected_source"]).hostname == "cuet.ac.bd"
        else:
            assert item["expected_source"] is None
            assert item["expected_key_facts"] == []


def test_public_answer_contract_never_requires_source_rendering():
    """The benchmark stores sources for evaluation, not for browser rendering."""
    public_fields = {"answer", "status"}
    assert "sources" not in public_fields
