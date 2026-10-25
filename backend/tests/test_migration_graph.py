"""The Alembic revision graph must stay linear and fully connected."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_migration_graph_has_one_base_and_one_head():
    scripts = ScriptDirectory.from_config(Config(str(BACKEND_ROOT / "alembic.ini")))
    assert len(scripts.get_bases()) == 1
    assert len(scripts.get_heads()) == 1
    revisions = list(scripts.walk_revisions())
    assert len(revisions) == 13
    assert all(revision.is_branch_point is False for revision in revisions)
