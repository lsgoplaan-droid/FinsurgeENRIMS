"""Tests for transaction endpoints and creation with rules engine."""


def test_list_transactions(client, auth_headers):
    res = client.get("/api/v1/transactions", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0


def test_list_transactions_with_filters(client, auth_headers):
    res = client.get("/api/v1/transactions?channel=branch&page_size=5", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["channel"] == "branch"


def test_list_transactions_flagged(client, auth_headers):
    res = client.get("/api/v1/transactions?is_flagged=true", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["is_flagged"] is True


def test_transaction_stats(client, auth_headers):
    res = client.get("/api/v1/transactions/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_count"] > 0
    assert "by_channel" in data


def test_create_transaction_triggers_rules(client, auth_headers):
    # Get a high-risk customer
    cust_res = client.get("/api/v1/customers?risk_category=high&page_size=1", headers=auth_headers)
    customer = cust_res.json()["items"][0]

    # Get their account
    c360 = client.get(f"/api/v1/customers/{customer['id']}/360", headers=auth_headers)
    account = c360.json()["accounts"][0]

    # Create a suspicious large cash deposit
    res = client.post("/api/v1/transactions", headers=auth_headers, json={
        "account_id": account["id"],
        "customer_id": customer["id"],
        "transaction_type": "credit",
        "transaction_method": "cash_deposit",
        "channel": "branch",
        "amount": 1500000_00,  # INR 15 lakh — above CTR threshold
        "location_city": "Mumbai",
    })
    assert res.status_code == 200
    data = res.json()

    # Rules engine should have evaluated
    engine = data["rules_engine"]
    assert engine["rules_evaluated"] > 0
    assert engine["risk_score"] > 0
    assert engine["is_flagged"] is True
    assert engine["alerts_created"] >= 1
