import os

import pytest


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """테스트마다 격리된 DB를 쓰는 TestClient."""
    monkeypatch.setenv("ANBU_DB", str(tmp_path / "test.db"))
    monkeypatch.delenv("ANBU_REQUIRE_AUTH", raising=False)
    from fastapi.testclient import TestClient

    from anbu_api.main import app
    return TestClient(app)


@pytest.fixture()
def strict_client(tmp_path, monkeypatch):
    """운영 모드(인증 필수) TestClient."""
    monkeypatch.setenv("ANBU_DB", str(tmp_path / "strict.db"))
    monkeypatch.setenv("ANBU_REQUIRE_AUTH", "1")
    from fastapi.testclient import TestClient

    from anbu_api.main import app
    return TestClient(app)
