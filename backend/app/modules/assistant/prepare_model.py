"""Build-time model download only: no credentials, database access or indexing."""

from hashlib import file_digest
from shutil import copyfile

from app.modules.assistant.embeddings import BUNDLED_MODEL, load_fastembed


def main() -> None:
    model_name = "BAAI/bge-small-en-v1.5"
    client = load_fastembed(model_name, False)
    vector = next(client.query_embed("Where is CUET?"))
    if len(vector) != 384:
        raise RuntimeError("Unexpected embedding model dimension")
    # Flatten the five required files. HF's shared blob/snapshot cache otherwise
    # gets bundled more than once when symlinks are dereferenced by the platform.
    source = client.model._model_dir  # FastEmbed 0.8.1's downloaded snapshot.
    # The Neon vectors were created with this exact ONNX artifact. Fail a new
    # build if upstream changes it rather than silently querying stale vectors.
    with (source / "model_optimized.onnx").open("rb") as model_file:
        digest = file_digest(model_file, "sha256").hexdigest()
    if digest != "51f1bd0addd6e859e42c2c8021a5e5461385bb676a649f4b269aa445449f2431":
        raise RuntimeError(
            "Embedding artifact changed; review and reindex before release"
        )
    BUNDLED_MODEL.mkdir(parents=True, exist_ok=True)
    for name in (
        "model_optimized.onnx",
        "config.json",
        "tokenizer.json",
        "special_tokens_map.json",
        "tokenizer_config.json",
    ):
        target = BUNDLED_MODEL / name
        if source.joinpath(name).resolve() != target.resolve():
            copyfile(source / name, target)
    # Prove the deployed model can load without an internet download.
    offline = load_fastembed(model_name, True)
    if len(next(offline.query_embed("CUET campus"))) != 384:
        raise RuntimeError("Offline embedding model verification failed")
    print("CPU embedding model ready; offline loading verified (384 dimensions)")


if __name__ == "__main__":
    main()
