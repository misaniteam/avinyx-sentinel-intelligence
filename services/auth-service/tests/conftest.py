"""Shared fixtures for auth-service tests.

Provides a FastAPI TestClient with dependency overrides so that
database, auth, and tenant dependencies are mocked out.
"""

import sys
import importlib
import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

# Ensure the service root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ---------------------------------------------------------------------------
# Workaround: SQLAlchemy 2.0 reserves 'metadata' as an attribute name on
# declarative models. The VoterInteraction model uses a column named
# 'metadata', which causes an import error. We pre-load a patched version
# of the voter module into sys.modules BEFORE anything else imports it.
# ---------------------------------------------------------------------------
_shared_root = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "shared"

# First, ensure sentinel_shared and sentinel_shared.models packages exist in sys.modules
# so that importing the voter submodule doesn't trigger __init__.py chain.
for _pkg in [
    "sentinel_shared",
    "sentinel_shared.models",
]:
    if _pkg not in sys.modules:
        _spec = importlib.util.find_spec(_pkg)
        if _spec:
            _mod = importlib.util.module_from_spec(_spec)
            sys.modules[_pkg] = _mod
            # Don't exec the __init__.py yet for models — it imports voter

# Now load voter.py with patched source
_voter_path = _shared_root / "sentinel_shared" / "models" / "voter.py"
_voter_source = _voter_path.read_text().replace(
    "    metadata = Column(JSONB",
    '    interaction_metadata = Column("metadata", JSONB',
)

_voter_spec = importlib.util.spec_from_file_location(
    "sentinel_shared.models.voter", str(_voter_path)
)
_voter_module = importlib.util.module_from_spec(_voter_spec)
sys.modules["sentinel_shared.models.voter"] = _voter_module

# We need sentinel_shared.models.base and sentinel_shared.database.session
# to be importable before exec'ing the voter module source.
# Import them directly (they don't trigger the voter import).
import sentinel_shared.database.session  # noqa: E402
import sentinel_shared.models.base  # noqa: E402

exec(compile(_voter_source, str(_voter_path), "exec"), _voter_module.__dict__)

# Now let the models __init__.py run properly
# (voter is already in sys.modules so it won't re-import)
if "sentinel_shared.models" in sys.modules:
    _models_spec = importlib.util.find_spec("sentinel_shared.models")
    if _models_spec and _models_spec.origin:
        _models_mod = sys.modules["sentinel_shared.models"]
        exec(
            compile(
                Path(_models_spec.origin).read_text(),
                str(_models_spec.origin),
                "exec",
            ),
            _models_mod.__dict__,
        )

# ---------------------------------------------------------------------------
# Now safe to import the app and dependencies
# ---------------------------------------------------------------------------
from main import app  # noqa: E402
from sentinel_shared.database.session import get_db  # noqa: E402
from sentinel_shared.auth.dependencies import (  # noqa: E402
    get_current_tenant_required,
    require_permissions,
)

FAKE_TENANT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

FAKE_USER = {
    "sub": "user-1",
    "tenant_id": FAKE_TENANT_ID,
    "is_super_admin": False,
    "permissions": ["*"],
}


class FakeDBResult:
    """Mimics the result object returned by db.execute()."""

    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar = scalar

    def all(self):
        return self._rows

    def scalars(self):
        return self

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar


class FakeDB:
    """Async mock for SQLAlchemy AsyncSession."""

    def __init__(self):
        self._execute_result = FakeDBResult()
        self._added = []

    async def execute(self, stmt):
        return self._execute_result

    def add(self, obj):
        self._added.append(obj)

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass

    async def delete(self, obj):
        pass

    def set_execute_result(self, result: FakeDBResult):
        self._execute_result = result


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def client(fake_db):
    """TestClient with all auth/db dependencies overridden."""

    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[get_current_tenant_required] = lambda: FAKE_TENANT_ID

    # We can't easily override the dynamic require_permissions, so instead
    # we override get_current_user which is the underlying dependency.
    from sentinel_shared.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER

    yield TestClient(app)

    app.dependency_overrides.clear()
