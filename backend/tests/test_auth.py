"""Tests for authentication and authorization."""


def test_login_success(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Demo@2026"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert "admin" in data["user"]["roles"]


def test_login_wrong_password(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


def test_login_nonexistent_user(client):
    res = client.post("/api/v1/auth/login", json={"username": "nobody", "password": "test"})
    assert res.status_code == 401


def test_get_me(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


def test_unauthorized_access(client):
    res = client.get("/api/v1/customers")
    assert res.status_code == 403 or res.status_code == 401


def test_invalid_token(client):
    res = client.get("/api/v1/customers", headers={"Authorization": "Bearer invalid_token"})
    assert res.status_code == 401


def test_password_policy():
    from app.services.auth_service import validate_password_policy
    errors = validate_password_policy("short")
    assert len(errors) > 0
    assert any("12 characters" in e for e in errors)

    errors = validate_password_policy("ValidPass@1234")
    assert len(errors) == 0
