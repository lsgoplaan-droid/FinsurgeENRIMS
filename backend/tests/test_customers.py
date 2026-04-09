"""Tests for customer endpoints."""


def test_list_customers(client, auth_headers):
    res = client.get("/api/v1/customers", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0


def test_search_customers(client, auth_headers):
    res = client.get("/api/v1/customers?search=Rajesh", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert any("Rajesh" in c["display_name"] for c in items)


def test_filter_by_risk(client, auth_headers):
    res = client.get("/api/v1/customers?risk_category=very_high", headers=auth_headers)
    assert res.status_code == 200
    for c in res.json()["items"]:
        assert c["risk_category"] == "very_high"


def test_customer_360(client, auth_headers):
    cust = client.get("/api/v1/customers?page_size=1", headers=auth_headers).json()["items"][0]
    res = client.get(f"/api/v1/customers/{cust['id']}/360", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "customer" in data
    assert "accounts" in data
    assert "recent_transactions" in data


def test_customer_not_found(client, auth_headers):
    res = client.get("/api/v1/customers/nonexistent", headers=auth_headers)
    assert res.status_code == 404
