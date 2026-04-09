"""Tests for alert endpoints."""


def test_list_alerts(client, auth_headers):
    res = client.get("/api/v1/alerts", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] > 0


def test_alert_stats(client, auth_headers):
    res = client.get("/api/v1/alerts/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    assert "by_priority" in data
    assert "by_type" in data


def test_filter_alerts_by_status(client, auth_headers):
    res = client.get("/api/v1/alerts?status=new", headers=auth_headers)
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["status"] == "new"


def test_get_alert_detail(client, auth_headers):
    # Get first alert
    alerts = client.get("/api/v1/alerts?page_size=1", headers=auth_headers).json()
    alert_id = alerts["items"][0]["id"]

    res = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == alert_id
    assert "title" in data
    assert "priority" in data


def test_add_note_to_alert(client, auth_headers):
    alerts = client.get("/api/v1/alerts?page_size=1", headers=auth_headers).json()
    alert_id = alerts["items"][0]["id"]

    res = client.post(f"/api/v1/alerts/{alert_id}/add-note", headers=auth_headers, json={"note": "Test investigation note"})
    assert res.status_code == 200


def test_close_alert(client, auth_headers):
    alerts = client.get("/api/v1/alerts?status=new&page_size=1", headers=auth_headers).json()
    if not alerts["items"]:
        return  # Skip if no new alerts
    alert_id = alerts["items"][0]["id"]

    res = client.post(f"/api/v1/alerts/{alert_id}/close", headers=auth_headers, json={
        "disposition": "false_positive",
        "reason": "Test closure — normal business activity"
    })
    assert res.status_code == 200
    assert "closed" in res.json()["status"]


def test_alert_not_found(client, auth_headers):
    res = client.get("/api/v1/alerts/nonexistent-id", headers=auth_headers)
    assert res.status_code == 404
