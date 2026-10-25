"""Cloud embedding wiring without downloading weights during tests."""

from types import SimpleNamespace

from app.modules.assistant.curated import source_is_eligible
from app.modules.assistant.embeddings import (
    FastEmbedProvider,
    create_embedding_provider,
)


def test_cloud_model_identity_cannot_match_ollama_vectors(settings):
    cloud = settings.model_copy(
        update={"rag_embedding_provider": "fastembed", "rag_knowledge_mode": "web"}
    )
    source = SimpleNamespace(
        url="https://cuet.ac.bd/about",
        source_metadata={"embeddingModel": settings.ollama_embedding_model},
    )
    assert cloud.assistant_embedding_model == "fastembed:BAAI/bge-small-en-v1.5"
    assert not source_is_eligible(source, cloud, None)
    source.source_metadata["embeddingModel"] = cloud.assistant_embedding_model
    assert source_is_eligible(source, cloud, None)


def test_production_embeddings_use_offline_cpu_cache(settings, monkeypatch):
    calls = []

    class Vector:
        def tolist(self):
            return [1.0, 2.0]

    class Client:
        def query_embed(self, text):
            assert text == "Where is CUET?"
            yield Vector()

        def passage_embed(self, texts):
            yield from (Vector() for _ in texts)

    def load(model, offline):
        calls.append((model, offline))
        return Client()

    monkeypatch.setattr("app.modules.assistant.embeddings.load_fastembed", load)
    cloud = settings.model_copy(
        update={"app_env": "production", "rag_embedding_provider": "fastembed"}
    )
    provider = create_embedding_provider(cloud)
    assert isinstance(provider, FastEmbedProvider)
    assert calls == [(cloud.fastembed_model, True)]
    assert provider.embed_query("Where is CUET?") == [1.0, 2.0]
    assert provider.embed_documents(["a", "b"]) == [[1.0, 2.0], [1.0, 2.0]]
