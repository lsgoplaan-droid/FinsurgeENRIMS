"""Tests for case management endpoints."""


def test_list_cases(client, auth_headers):
    res = client.get("/api/v1/cases", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] > 0


def test_case_stats(client, auth_headers):
    res = client.get("/api/v1/cases/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0


def test_get_case_detail(client, auth_headers):
    cases = client.get("/api/v1/cases?page_size=1", headers=auth_headers).json()
    case_id = cases["items"][0]["id"]
    res = client.get(f"/api/v1/cases/{case_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == case_id


def test_get_case_timeline(client, auth_headers):
    cases = client.get("/api/v1/cases?page_size=1", headers=auth_headers).json()
    case_id = cases["items"][0]["id"]
    res = client.get(f"/api/v1/cases/{case_id}/timeline", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_case_not_found(client, auth_headers):
    res = client.get("/api/v1/cases/nonexistent-id", headers=auth_headers)
    assert res.status_code == 404
