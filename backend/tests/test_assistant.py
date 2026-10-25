"""Campus AI Assistant source policy, retrieval, and API contracts."""

import uuid
from datetime import UTC, date, datetime
from types import SimpleNamespace

import pytest
from bs4 import BeautifulSoup
from fastapi.testclient import TestClient
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import SecretStr
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.auth import AuthIdentity, get_current_user
from app.core.errors import AppError
from app.db.base import Base
from app.db.models import RagChunk, RagQueryAudit, RagSource, User
from app.main import create_app
from app.modules.assistant.curated import (
    CURATED_PREFIX,
    KNOWLEDGE_FILE,
    ingest_curated,
    load_knowledge,
    plain_text,
    source_is_eligible,
)
from app.modules.assistant.ingest import clean_text, parse_page_date
from app.modules.assistant.policy import SourcePolicy
from app.modules.assistant.router import get_assistant_service
from app.modules.assistant.service import RagAssistantService, cosine_similarity


class FakeEmbeddings:
    def embed_query(self, _text: str) -> list[float]:
        return [1.0, 0.0]


class FakeChat:
    def answer(self, *, question: str, context: str) -> str:
        assert question == "Where is CUET?"
        assert "Raozan" in context
        return "CUET is in Raozan, Chattogram."


class FailingChat:
    def answer(self, *, question: str, context: str) -> str:
        raise RuntimeError("private provider detail must not leave the API")


class FakeRouteService:
    def ask(self, user_id: str, question: str) -> dict:
        assert uuid.UUID(user_id)
        return {
            "answer": f"Grounded answer for: {question}",
            "status": "answered",
        }


@pytest.fixture
def assistant_stack(settings):
    # Legacy web retrieval remains supported only when explicitly selected.
    settings = settings.model_copy(update={"rag_knowledge_mode": "web"})
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = Session(engine, expire_on_commit=False)
    user = User(
        id=uuid.uuid4(),
        username="assistant.student",
        email="assistant@student.cuet.ac.bd",
        password_hash="test",
        role="student",
        university_id="assistant-001",
        first_name="Assistant",
        last_name="Student",
        home_address="CUET",
        verified_at=datetime.now(UTC),
        is_active=True,
    )
    db.add(user)
    db.commit()
    yield db, user, settings
    db.close()
    engine.dispose()


@pytest.fixture(autouse=True)
def fixed_knowledge_review_date(monkeypatch):
    # Retrieval tests must not expire just because CI runs after the snapshot date.
    monkeypatch.setattr(
        "app.modules.assistant.curated.knowledge_today", lambda: date(2026, 10, 8)
    )


def test_source_policy_restricts_hosts_protocols_and_portals():
    policy = SourcePolicy(("cuet.ac.bd",))
    assert policy.canonicalize("https://cuet.ac.bd/department/cse#faculty") == (
        "https://cuet.ac.bd/department/cse"
    )
    assert policy.canonicalize("/notice/example", base_url="https://cuet.ac.bd/") == (
        "https://cuet.ac.bd/notice/example"
    )
    assert policy.canonicalize("http://cuet.ac.bd/") is None
    assert policy.canonicalize("https://evil.example/") is None
    assert policy.canonicalize("https://cuet.ac.bd/admin/users") is None
    assert policy.canonicalize("https://cuet.ac.bd/logo.png") is None
    assert policy.canonicalize("https://cuet.ac.bd/files/notice.pdf") is not None


def test_text_preprocessing_dates_and_chunk_boundaries():
    raw = " CUET\u00a0Campus  \n\nCUET Campus\nEngineering   education "
    assert clean_text(raw) == "CUET Campus\nEngineering education"
    dated = BeautifulSoup(
        '<meta property="article:published_time" content="2026-09-28T10:30:00Z">',
        "html.parser",
    )
    assert parse_page_date(dated) == datetime(2026, 9, 28, 10, 30, tzinfo=UTC)
    assert parse_page_date(BeautifulSoup("<time>unknown</time>", "html.parser")) is None

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=80,
        chunk_overlap=15,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(" ".join(f"CUET-{index}" for index in range(60)))
    assert len(chunks) > 1
    assert all(0 < len(chunk) <= 80 for chunk in chunks)


def test_cosine_similarity_retrieval_helper():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
    assert cosine_similarity([], []) == -1.0
    assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == -1.0


def test_grounded_retrieval_returns_answer_without_sources(assistant_stack):
    db, user, settings = assistant_stack
    source = RagSource(
        url="https://cuet.ac.bd/about",
        title="About CUET",
        content_type="text/html",
        content_hash="a" * 64,
        status="active",
        crawled_at=datetime.now(UTC),
        source_metadata={"embeddingModel": settings.ollama_embedding_model},
    )
    db.add(source)
    db.flush()
    db.add(
        RagChunk(
            source_id=source.id,
            chunk_index=0,
            content="CUET is situated in Raozan, Chattogram.",
            content_hash="b" * 64,
            embedding=[1.0, 0.0],
        )
    )
    db.commit()
    service = RagAssistantService(
        db, settings, embeddings=FakeEmbeddings(), chat=FakeChat()
    )

    result = service.ask(str(user.id), "Where is CUET?")

    assert result["status"] == "answered"
    assert "sources" not in result
    assert "[1]" not in result["answer"]


def test_retrieval_ranks_the_relevant_cuet_chunk_first(assistant_stack):
    db, _, settings = assistant_stack
    relevant = RagSource(
        url="https://cuet.ac.bd/about",
        title="About CUET",
        content_type="text/html",
        content_hash="e" * 64,
        status="active",
        crawled_at=datetime.now(UTC),
        source_metadata={"embeddingModel": settings.ollama_embedding_model},
    )
    unrelated = RagSource(
        url="https://cuet.ac.bd/notice",
        title="Notices",
        content_type="text/html",
        content_hash="f" * 64,
        status="active",
        crawled_at=datetime.now(UTC),
        source_metadata={"embeddingModel": settings.ollama_embedding_model},
    )
    db.add_all([relevant, unrelated])
    db.flush()
    db.add_all(
        [
            RagChunk(
                source_id=relevant.id,
                chunk_index=0,
                content="CUET is situated in Raozan, Chattogram.",
                content_hash="1" * 64,
                embedding=[1.0, 0.0],
            ),
            RagChunk(
                source_id=unrelated.id,
                chunk_index=0,
                content="A general notice was published.",
                content_hash="2" * 64,
                embedding=[0.0, 1.0],
            ),
        ]
    )
    db.commit()

    matches = RagAssistantService(
        db, settings, embeddings=FakeEmbeddings(), chat=FakeChat()
    )._retrieve("Where is CUET?")

    assert matches[0].source.url == "https://cuet.ac.bd/about"
    assert matches[0].score == pytest.approx(1.0)


def test_empty_knowledge_returns_setup_error_without_model_call(assistant_stack):
    db, user, settings = assistant_stack
    service = RagAssistantService(db, settings)

    with pytest.raises(AppError) as caught:
        service.ask(str(user.id), "What is available?")
    assert caught.value.status_code == 503
    assert caught.value.code == "assistant_knowledge_not_ready"
    audit = db.scalar(select(RagQueryAudit).where(RagQueryAudit.user_id == user.id))
    assert audit.status == "failed"


@pytest.mark.parametrize("upstream_status", [200, 429, 401, 500])
def test_groq_is_used_by_authenticated_rag_and_errors_are_audited(
    assistant_stack, monkeypatch, upstream_status
):
    db, user, settings = assistant_stack
    settings = curated_settings(settings).model_copy(
        update={"groq_api_key": SecretStr("test-only-private-key")}
    )
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())

    def post(url, **kwargs):
        assert kwargs["json"]["model"] == "qwen/qwen3.8-27b"
        prompt = kwargs["json"]["messages"][1]["content"]
        assert "Raozan" in prompt
        assert str(user.id) not in prompt and user.email not in prompt
        return SimpleNamespace(
            status_code=upstream_status,
            json=lambda: {
                "choices": [{"message": {"content": "CUET is in Raozan. [1]"}}],
                "error": {"message": "test-only-private-key"},
            },
        )

    monkeypatch.setattr("app.modules.assistant.service.requests.post", post)
    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=str(user.id), role="student", is_active=True, is_verified=True
    )
    app.dependency_overrides[get_assistant_service] = lambda: RagAssistantService(
        db, settings, embeddings=FakeEmbeddings()
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask", json={"question": "Where is CUET?"}
        )
    assert "test-only-private-key" not in response.text
    if upstream_status == 200:
        assert response.status_code == 200
        assert response.json()["data"] == {
            "answer": "CUET is in Raozan.",
            "status": "answered",
        }
    else:
        assert response.status_code == (429 if upstream_status == 429 else 503)
    audit = db.scalar(select(RagQueryAudit).where(RagQueryAudit.user_id == user.id))
    assert audit.status == ("answered" if upstream_status == 200 else "failed")


def test_groq_is_not_called_when_context_is_unrelated(assistant_stack, monkeypatch):
    db, user, settings = assistant_stack
    settings = curated_settings(settings).model_copy(
        update={"groq_api_key": SecretStr("test-only-private-key")}
    )
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    for chunk in db.scalars(select(RagChunk)):
        chunk.embedding = [0.0, 1.0]
    db.commit()

    def no_call(*args, **kwargs):
        pytest.fail("Unrelated questions must not spend Groq quota")

    monkeypatch.setattr("app.modules.assistant.service.requests.post", no_call)
    result = RagAssistantService(db, settings, embeddings=FakeEmbeddings()).ask(
        str(user.id), "Unrelated question"
    )
    assert result["status"] == "not-found"


def test_unrelated_question_still_returns_not_found_from_a_ready_index(assistant_stack):
    db, user, settings = assistant_stack
    ingest_curated(db, curated_settings(settings), embedder=FakeDocumentEmbeddings())
    for chunk in db.scalars(select(RagChunk)):
        chunk.embedding = [0.0, 1.0]
    db.commit()
    service = RagAssistantService(
        db, curated_settings(settings), embeddings=FakeEmbeddings(), chat=FailingChat()
    )
    result = service.ask(str(user.id), "An unrelated question")
    assert result["status"] == "not-found"
    assert "sources" not in result


def test_missing_index_error_reaches_the_api(assistant_stack):
    db, user, settings = assistant_stack
    settings = curated_settings(settings)
    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=str(user.id), role="student", is_active=True, is_verified=True
    )
    app.dependency_overrides[get_assistant_service] = lambda: RagAssistantService(
        db, settings
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask", json={"question": "Where is CUET?"}
        )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "assistant_knowledge_not_ready"
    assert "rebuild" in response.json()["error"]["message"]


@pytest.mark.parametrize("problem", ["snapshot", "embedding-model", "expired"])
def test_ineligible_index_is_a_setup_error_not_an_unanswered_question(
    assistant_stack, monkeypatch, problem
):
    db, user, settings = assistant_stack
    settings = curated_settings(settings)
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    if problem == "expired":
        monkeypatch.setattr(
            "app.modules.assistant.curated.knowledge_today", lambda: date(2028, 1, 1)
        )
    else:
        key = "corpusHash" if problem == "snapshot" else "embeddingModel"
        for source in db.scalars(select(RagSource)):
            source.source_metadata = {**source.source_metadata, key: "out-of-date"}
        db.commit()
    with pytest.raises(AppError) as caught:
        RagAssistantService(db, settings).ask(str(user.id), "Where is CUET?")
    assert caught.value.code == "assistant_knowledge_not_ready"


def test_external_model_failure_is_a_safe_service_error(assistant_stack):
    db, user, settings = assistant_stack
    source = RagSource(
        url="https://cuet.ac.bd/about",
        title="About CUET",
        content_type="text/html",
        content_hash="c" * 64,
        status="active",
        crawled_at=datetime.now(UTC),
        source_metadata={"embeddingModel": settings.ollama_embedding_model},
    )
    db.add(source)
    db.flush()
    db.add(
        RagChunk(
            source_id=source.id,
            chunk_index=0,
            content="CUET is situated in Raozan, Chattogram.",
            content_hash="d" * 64,
            embedding=[1.0, 0.0],
        )
    )
    db.commit()
    service = RagAssistantService(
        db, settings, embeddings=FakeEmbeddings(), chat=FailingChat()
    )

    with pytest.raises(AppError) as caught:
        service.ask(str(user.id), "Where is CUET?")

    assert caught.value.status_code == 503
    assert "private provider detail" not in caught.value.message
    audit = db.scalar(select(RagQueryAudit).where(RagQueryAudit.user_id == user.id))
    assert audit is not None and audit.status == "failed"


def test_assistant_endpoint_is_authenticated_and_validated(settings):
    app = create_app(settings)
    user_id = str(uuid.uuid4())
    app.dependency_overrides[get_current_user] = lambda: AuthIdentity(
        id=user_id, role="student", is_active=True, is_verified=True
    )
    app.dependency_overrides[get_assistant_service] = lambda: FakeRouteService()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/assistant/ask", json={"question": " Where is CUET? "}
        )
        invalid = client.post("/api/v1/assistant/ask", json={"question": " "})

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "answered"
    assert invalid.status_code == 422


class FakeDocumentEmbeddings:
    def __init__(self):
        self.calls = 0

    def embed_documents(self, texts):
        self.calls += 1
        return [[1.0, 0.0] for _ in texts]


def curated_settings(settings):
    return settings.model_copy(update={"rag_knowledge_mode": "curated"})


def test_curated_documents_are_synced_and_cover_requested_topics():
    snapshot = load_knowledge()
    assert len(snapshot.sections) == 16
    topics = {section.key: section.text for section in snapshot.sections}
    assert "18 academic departments" in topics["academic-counts"]
    assert "five academic faculties" in topics["academic-counts"]
    assert "nine student halls" in topics["halls"]
    assert "four named research institutes" in topics["institutes"]
    assert "1401+" in topics["rankings"] and "2027" in topics["rankings"]
    assert "1401-1600" in topics["rankings"]
    assert "Sheikh Shariful Alam" in topics["vice-chancellor"]
    assert "could not be reliably established" in topics["pro-vc"]
    assert "Saiful Islam" in topics["student-welfare"]
    assert "22.46242" in topics["tsc"]
    assert "22.46082" in topics["incubator"]
    assert all(
        section.sources and section.reviewed <= section.review_after
        for section in snapshot.sections
    )
    markdown = KNOWLEDGE_FILE.read_text(encoding="utf-8")
    assert KNOWLEDGE_FILE.with_suffix(".txt").read_text(encoding="utf-8") == (
        plain_text(markdown)
    )


def test_curated_ingestion_is_offline_atomic_idempotent_and_model_aware(
    assistant_stack, monkeypatch
):
    db, _, settings = assistant_stack
    settings = curated_settings(settings)
    embedder = FakeDocumentEmbeddings()

    def no_network(*args, **kwargs):
        raise AssertionError("Curated file loading must not scrape a website")

    monkeypatch.setattr("requests.Session.get", no_network)
    first = ingest_curated(db, settings, embedder=embedder)
    second = ingest_curated(db, settings, embedder=embedder)
    assert first["updated"] == 16 and first["chunks"] >= 16
    assert second["unchanged"] == 16 and second["updated"] == 0
    assert embedder.calls == 1
    source = db.scalar(
        select(RagSource).where(RagSource.url == CURATED_PREFIX + "vice-chancellor")
    )
    assert source.source_metadata["evidenceUrls"]
    assert source.source_metadata["reviewedAt"] == "2026-10-08"
    assert source_is_eligible(
        source, settings, load_knowledge(), today=date(2026, 10, 8)
    )
    new_model = settings.model_copy(
        update={"ollama_embedding_model": "different-model"}
    )
    third = ingest_curated(db, new_model, embedder=embedder)
    assert third["updated"] == 16 and embedder.calls == 2
    fourth = ingest_curated(db, new_model, embedder=embedder, force=True)
    assert fourth["updated"] == 16 and embedder.calls == 3


@pytest.mark.parametrize(
    "bad_vector", [[], [0.0, 0.0], [float("nan"), 0.0], [float("inf"), 0.0]]
)
def test_invalid_vectors_never_replace_good_curated_index(assistant_stack, bad_vector):
    db, _, settings = assistant_stack
    settings = curated_settings(settings)
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    before = list(db.scalars(select(RagChunk.id)))

    class BadEmbedder:
        def embed_documents(self, texts):
            return [bad_vector for _ in texts]

    with pytest.raises(ValueError, match="invalid vector"):
        ingest_curated(db, settings, embedder=BadEmbedder(), force=True)
    assert list(db.scalars(select(RagChunk.id))) == before


def test_provider_failure_preserves_existing_snapshot(assistant_stack):
    db, _, settings = assistant_stack
    settings = curated_settings(settings)
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    before = list(db.scalars(select(RagChunk.id)))

    class UnavailableEmbedder:
        def embed_documents(self, texts):
            raise RuntimeError("Offline model server")

    with pytest.raises(RuntimeError):
        ingest_curated(db, settings, embedder=UnavailableEmbedder(), force=True)
    assert list(db.scalars(select(RagChunk.id))) == before


def test_curated_retrieval_excludes_legacy_scrapes_and_returns_no_sources(
    assistant_stack,
):
    db, user, settings = assistant_stack
    settings = curated_settings(settings)
    db.add(
        RagSource(
            url="https://cuet.ac.bd/about",
            title="Old navigation scrape",
            content_type="text/html",
            status="active",
            crawled_at=datetime.now(UTC),
            source_metadata={"embeddingModel": settings.ollama_embedding_model},
        )
    )
    db.commit()
    service = RagAssistantService(db, settings)
    with pytest.raises(AppError) as caught:
        service.ask(str(user.id), "Where is CUET?")
    assert caught.value.code == "assistant_knowledge_not_ready"
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    service = RagAssistantService(
        db, settings, embeddings=FakeEmbeddings(), chat=FakeChat()
    )
    matches = service._retrieve("Where is CUET?")
    assert matches
    assert all(match.source.url.startswith(CURATED_PREFIX) for match in matches)
    result = service.ask(str(user.id), "Where is CUET?")
    assert result == {"answer": "CUET is in Raozan, Chattogram.", "status": "answered"}


def test_eligibility_excludes_expired_changed_and_mismatched_model_sections(
    assistant_stack,
):
    db, _, settings = assistant_stack
    settings = curated_settings(settings)
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    source = db.scalar(
        select(RagSource).where(RagSource.url == CURATED_PREFIX + "vice-chancellor")
    )
    snapshot = load_knowledge()
    assert not source_is_eligible(source, settings, snapshot, today=date(2026, 10, 16))
    assert not source_is_eligible(source, settings, snapshot, today=date(2026, 10, 7))
    source.source_metadata = {**source.source_metadata, "corpusHash": "old"}
    assert not source_is_eligible(source, settings, snapshot, today=date(2026, 10, 8))
    source.source_metadata = {
        **source.source_metadata,
        "corpusHash": snapshot.digest,
        "embeddingModel": "wrong-model",
    }
    assert not source_is_eligible(source, settings, snapshot, today=date(2026, 10, 8))


def test_parser_rejects_unsynced_or_duplicated_sections(tmp_path):
    path = tmp_path / "knowledge.md"
    markdown = KNOWLEDGE_FILE.read_text(encoding="utf-8")
    path.write_text(markdown, encoding="utf-8")
    path.with_suffix(".txt").write_text("different content", encoding="utf-8")
    with pytest.raises(ValueError, match="out of sync"):
        load_knowledge(path)
    duplicate = (
        markdown
        + "\n## identity | Duplicate\n"
        + markdown.split("## identity | CUET identity, location and address\n", 1)[
            1
        ].split("\n## history", 1)[0]
    )
    path.write_text(duplicate, encoding="utf-8")
    path.with_suffix(".txt").write_text(plain_text(duplicate), encoding="utf-8")
    with pytest.raises(ValueError, match="unique stable slugs"):
        load_knowledge(path)


def test_nonfinite_cosine_vectors_are_rejected():
    assert cosine_similarity([float("nan"), 0.0], [1.0, 0.0]) == -1
    assert cosine_similarity([float("inf"), 0.0], [1.0, 0.0]) == -1


def test_only_relevant_chunks_enter_prompt_and_evidence_urls_stay_internal(
    assistant_stack,
):
    db, user, settings = assistant_stack
    settings = curated_settings(settings)
    ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    for chunk in db.scalars(select(RagChunk)):
        source = db.get(RagSource, chunk.source_id)
        chunk.embedding = (
            [1.0, 0.0] if source.url == CURATED_PREFIX + "rankings" else [0.0, 1.0]
        )
    db.commit()

    class RankingChat:
        def answer(self, *, question, context):
            assert "QS World University Rankings 2027" in context
            assert "THE" in context and "1401-1600" in context
            assert "Sheikh Shariful Alam" not in context
            assert "https://" not in context and CURATED_PREFIX not in context
            assert "Reviewed: 2026-10-08" in context
            return "QS 2027: 1401+. THE 2027: 1401-1600."

    service = RagAssistantService(
        db, settings, embeddings=FakeEmbeddings(), chat=RankingChat()
    )
    result = service.ask(str(user.id), "What is CUET's world rank?")
    assert result["status"] == "answered"
    assert "sources" not in result


def test_admin_knowledge_status_counts_only_eligible_curated_data(assistant_stack):
    from app.modules.assistant.router import knowledge_status

    db, user, settings = assistant_stack
    settings = curated_settings(settings)
    stats = ingest_curated(db, settings, embedder=FakeDocumentEmbeddings())
    db.add(
        RagSource(
            url="https://cuet.ac.bd/stale-navigation",
            title="Old scrape",
            content_type="text/html",
            status="active",
            crawled_at=datetime.now(UTC),
            source_metadata={"embeddingModel": settings.ollama_embedding_model},
        )
    )
    db.commit()
    data = knowledge_status(
        db,
        AuthIdentity(id=str(user.id), role="admin", is_active=True, is_verified=True),
        settings,
    ).data
    assert data["sourceCount"] == 17
    assert data["activeSourceCount"] == 16
    assert data["chunkCount"] == stats["chunks"]
    assert data["knowledgeMode"] == "curated"
    assert data["reviewDueSections"] == []
