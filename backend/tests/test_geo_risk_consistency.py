"""
Tests to verify geographic risk heatmap data consistency across endpoints.
Ensures that drill-down from heatmap to customer list shows matching counts.
"""
import pytest


def test_geo_risk_delhi_high_risk_count(client, auth_headers):
    """Verify geo-risk endpoint returns correct high-risk count for Delhi."""
    resp = client.get("/api/v1/dashboard/geo-risk", headers=auth_headers)
    assert resp.status_code == 200

    data = resp.json()
    delhi = next((s for s in data['states'] if s['state'] == 'Delhi'), None)
    assert delhi is not None, "Delhi not found in geo-risk states"
    assert delhi['high_risk_count'] == 3, "Delhi should have 3 high-risk customers"
    assert delhi['customers'] == 6, "Delhi should have 6 total customers"


def test_customers_list_delhi_high_risk_count(client, auth_headers):
    """Verify customers endpoint returns matching count when filtered by state and risk."""
    resp = client.get(
        "/api/v1/customers?state=Delhi&risk_category=high&page_size=100",
        headers=auth_headers
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data['total'] == 3, "Delhi high-risk customers should be 3"
    assert len(data['items']) == 3, "Should return 3 customer items"


def test_geo_risk_drill_down_endpoint(client, auth_headers):
    """Verify dedicated drill-down endpoint matches geo-risk summary."""
    resp = client.get(
        "/api/v1/dashboard/geo-risk/Delhi/customers?risk_category=high&page_size=100",
        headers=auth_headers
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data['total'] == 3, "Drill-down should show 3 high-risk customers"
    assert data['state'] == 'Delhi'
    assert data['risk_category'] == 'high'


def test_geo_risk_consistency_across_endpoints(client, auth_headers):
    """Verify all three endpoints return consistent high-risk count for Delhi."""
    # Get geo-risk summary
    geo_resp = client.get("/api/v1/dashboard/geo-risk", headers=auth_headers)
    delhi_geo = next(
        (s for s in geo_resp.json()['states'] if s['state'] == 'Delhi'),
        None
    )
    geo_high_risk_count = delhi_geo['high_risk_count']

    # Get customers list
    cust_resp = client.get(
        "/api/v1/customers?state=Delhi&risk_category=high&page_size=100",
        headers=auth_headers
    )
    cust_high_risk_count = cust_resp.json()['total']

    # Get drill-down endpoint
    drill_resp = client.get(
        "/api/v1/dashboard/geo-risk/Delhi/customers?risk_category=high&page_size=100",
        headers=auth_headers
    )
    drill_high_risk_count = drill_resp.json()['total']

    # All three should match
    assert geo_high_risk_count == cust_high_risk_count, \
        f"Geo-risk count ({geo_high_risk_count}) should match customers list count ({cust_high_risk_count})"
    assert cust_high_risk_count == drill_high_risk_count, \
        f"Customers list count ({cust_high_risk_count}) should match drill-down count ({drill_high_risk_count})"
    assert geo_high_risk_count == drill_high_risk_count == 3, \
        "All three endpoints should show 3 high-risk customers in Delhi"
