"""
Tests for the rules engine evaluator.
Tests each rule category with positive and negative cases.
"""
import json
import uuid
from datetime import datetime, timedelta
from app.engine.evaluator import (
    _evaluate_condition, _calculate_risk_score, _op_equals, _op_greater_than,
    _op_between, _op_in, _op_not_in, _op_contains, _op_less_than,
)


# ── Operator tests ──────────────────────────────────────────────────────────

def test_op_equals():
    assert _op_equals("branch", "branch") is True
    assert _op_equals("atm", "branch") is False


def test_op_greater_than():
    assert _op_greater_than(1000000, 500000) is True
    assert _op_greater_than(500000, 1000000) is False
    assert _op_greater_than(None, 100) is False


def test_op_less_than():
    assert _op_less_than(100, 500) is True
    assert _op_less_than(500, 100) is False


def test_op_between():
    assert _op_between(950000, [900000, 999999]) is True
    assert _op_between(800000, [900000, 999999]) is False
    assert _op_between(1000000, [900000, 999999]) is False


def test_op_in():
    assert _op_in("cash_deposit", ["cash_deposit", "cash_withdrawal"]) is True
    assert _op_in("neft", ["cash_deposit", "cash_withdrawal"]) is False


def test_op_not_in():
    assert _op_not_in("neft", ["cash_deposit", "cash_withdrawal"]) is True
    assert _op_not_in("cash_deposit", ["cash_deposit", "cash_withdrawal"]) is False


def test_op_contains():
    assert _op_contains("Large cash deposit at Mumbai", "cash") is True
    assert _op_contains("Wire transfer", "cash") is False


# ── Condition evaluator tests ───────────────────────────────────────────────

def _make_context(amount=500000_00, method="neft", channel="internet_banking",
                  txn_type="credit", city="Thimphu", country="BT",
                  risk_score=10, risk_category="low", pep=False,
                  acct_type="savings", balance=1000000_00, acct_status="active"):
    return {
        "transaction": {
            "amount": amount, "channel": channel, "transaction_method": method,
            "transaction_type": txn_type, "location_city": city, "location_country": country,
            "counterparty_account": None, "counterparty_bank": None,
            "ip_address": "192.168.1.1", "device_id": "dev-001", "description": "test txn",
        },
        "customer": {
            "risk_score": risk_score, "risk_category": risk_category,
            "customer_type": "individual", "nationality": "BT",
            "pep_status": pep, "occupation": "Engineer",
            "annual_income": 3000000_00,
        },
        "account": {
            "account_type": acct_type, "balance": balance, "status": acct_status,
        },
    }


def _make_aggregates(txn_count=1, txn_sum=500000_00, cash_count=0, cash_sum=0,
                     counterparties=1, channels=1, locations=1, round_count=0):
    return {
        "transaction_count": txn_count, "transaction_sum": txn_sum,
        "cash_transaction_count": cash_count, "cash_transaction_sum": cash_sum,
        "unique_counterparties": counterparties, "unique_channels": channels,
        "unique_locations": locations, "max_transaction_amount": txn_sum,
        "avg_transaction_amount": txn_sum, "round_amount_count": round_count,
    }


# ── Structuring pattern tests ──────────────────────────────────────────────

def test_rule_str001_positive():
    """Single cash transaction >= 10L should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.amount", "operator": "greater_than_or_equal", "value": 1000000_00},
        {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]},
    ]}
    ctx = _make_context(amount=1500000_00, method="cash_deposit")
    assert _evaluate_condition(condition, ctx, {}) is True


def test_rule_str001_negative():
    """Amount below threshold should not match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.amount", "operator": "greater_than_or_equal", "value": 1000000_00},
        {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]},
    ]}
    ctx = _make_context(amount=500000_00, method="cash_deposit")
    assert _evaluate_condition(condition, ctx, {}) is False


def test_rule_str003_positive():
    """Cash deposit between 9L-10L with multiple transactions should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.amount", "operator": "between", "value": [900000_00, 999999_00]},
        {"field": "transaction.transaction_method", "operator": "equals", "value": "cash_deposit"},
        {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 2, "time_window": "7d"},
    ]}
    ctx = _make_context(amount=950000_00, method="cash_deposit")
    agg = _make_aggregates(txn_count=5)
    assert _evaluate_condition(condition, ctx, agg) is True


def test_rule_str003_negative():
    """Amount outside structuring range should not match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.amount", "operator": "between", "value": [900000_00, 999999_00]},
        {"field": "transaction.transaction_method", "operator": "equals", "value": "cash_deposit"},
        {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 2, "time_window": "7d"},
    ]}
    ctx = _make_context(amount=500000_00, method="cash_deposit")
    agg = _make_aggregates(txn_count=5)
    assert _evaluate_condition(condition, ctx, agg) is False


# ── Layering / fund movement pattern tests ─────────────────────────────────

def test_rule_lay001_positive():
    """Many counterparties + high sum in 24h should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "aggregate.unique_counterparties", "operator": "greater_than", "value": 3},
        {"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 5000000_00},
    ]}
    ctx = _make_context()
    agg = _make_aggregates(counterparties=5, txn_sum=8000000_00)
    assert _evaluate_condition(condition, ctx, agg) is True


def test_rule_lay001_negative():
    """Few counterparties should not match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "aggregate.unique_counterparties", "operator": "greater_than", "value": 3},
        {"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 5000000_00},
    ]}
    ctx = _make_context()
    agg = _make_aggregates(counterparties=1, txn_sum=8000000_00)
    assert _evaluate_condition(condition, ctx, agg) is False


# ── Geographic risk tests ──────────────────────────────────────────────────

def test_rule_geo001_positive():
    """Transaction from high-risk country should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.location_country", "operator": "in", "value": ["AF", "IR", "KP", "SY", "YE", "MM"]},
    ]}
    ctx = _make_context(country="IR")
    assert _evaluate_condition(condition, ctx, {}) is True


def test_rule_geo001_negative():
    """Transaction from Bhutan should not match high-risk country rule."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.location_country", "operator": "in", "value": ["AF", "IR", "KP", "SY", "YE", "MM"]},
    ]}
    ctx = _make_context(country="BT")
    assert _evaluate_condition(condition, ctx, {}) is False


# ── Fraud Card rule tests ──────────────────────────────────────────────────

def test_rule_crd001_positive():
    """Card used in multiple locations within window should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.transaction_method", "operator": "equals", "value": "card_payment"},
        {"field": "aggregate.unique_locations", "operator": "greater_than", "value": 1},
    ]}
    ctx = _make_context(method="card_payment")
    agg = _make_aggregates(locations=3)
    assert _evaluate_condition(condition, ctx, agg) is True


def test_rule_crd001_negative():
    """Card in single location should not match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.transaction_method", "operator": "equals", "value": "card_payment"},
        {"field": "aggregate.unique_locations", "operator": "greater_than", "value": 1},
    ]}
    ctx = _make_context(method="card_payment")
    agg = _make_aggregates(locations=1)
    assert _evaluate_condition(condition, ctx, agg) is False


# ── PEP monitoring tests ────────────────────────────────────────────────────

def test_rule_pep001_positive():
    """PEP customer + large cash transaction should match."""
    condition = {"logic": "AND", "conditions": [
        {"field": "customer.pep_status", "operator": "equals", "value": True},
        {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]},
        {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00},
    ]}
    ctx = _make_context(amount=500000_00, method="cash_deposit", pep=True)
    assert _evaluate_condition(condition, ctx, {}) is True


def test_rule_pep001_negative():
    """Non-PEP customer should not match PEP rule."""
    condition = {"logic": "AND", "conditions": [
        {"field": "customer.pep_status", "operator": "equals", "value": True},
        {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]},
        {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00},
    ]}
    ctx = _make_context(amount=500000_00, method="cash_deposit", pep=False)
    assert _evaluate_condition(condition, ctx, {}) is False


# ── Nested OR logic test ───────────────────────────────────────────────────

def test_nested_or_logic():
    """Test nested OR within AND."""
    condition = {"logic": "AND", "conditions": [
        {"field": "transaction.amount", "operator": "greater_than", "value": 100000},
        {"logic": "OR", "conditions": [
            {"field": "transaction.channel", "operator": "equals", "value": "branch"},
            {"field": "transaction.channel", "operator": "equals", "value": "atm"},
        ]},
    ]}
    ctx = _make_context(amount=200000, channel="atm")
    assert _evaluate_condition(condition, ctx, {}) is True

    ctx2 = _make_context(amount=200000, channel="internet_banking")
    assert _evaluate_condition(condition, ctx2, {}) is False


# ── Risk scoring test ──────────────────────────────────────────────────────

def test_risk_scoring():
    from app.models import Rule, Transaction
    ctx = _make_context(risk_category="high")
    # Create mock objects
    class MockRule:
        severity = "critical"
    class MockTxn:
        channel = "swift"

    score = _calculate_risk_score(MockTxn(), [MockRule(), MockRule()], ctx)
    # base(10) + 2*critical(40) + swift(10) + high(20) = 120, capped at 100
    assert score == 100.0


# ── Masking tests ──────────────────────────────────────────────────────────

def test_mask_pan():
    from app.utils.masking import mask_pan
    assert mask_pan("ABCDE1234F") == "XXXXXX234X"
    assert mask_pan(None) == ""


def test_mask_phone():
    from app.utils.masking import mask_phone
    assert mask_phone("+919876543210") == "+91XXXXXX3210"
    assert mask_phone(None) == ""


def test_mask_email():
    from app.utils.masking import mask_email
    assert mask_email("user@domain.com") == "u***@domain.com"
    assert mask_email(None) == ""


# ── Encryption tests ───────────────────────────────────────────────────────

def test_encrypt_decrypt_pii():
    from app.utils.encryption import encrypt_pii, decrypt_pii
    original = "ABCDE1234F"
    encrypted = encrypt_pii(original)
    assert encrypted != original
    decrypted = decrypt_pii(encrypted)
    assert decrypted == original


def test_encrypt_empty():
    from app.utils.encryption import encrypt_pii, decrypt_pii
    assert encrypt_pii("") == ""
    assert decrypt_pii("") == ""
