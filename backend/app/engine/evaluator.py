"""
Core rules engine evaluator.
Evaluates a transaction against all enabled rules, generates alerts, and adjusts risk scores.
"""
import json
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models import Rule, Transaction, Customer, Account, Alert


# ── Operator functions ──────────────────────────────────────────────────────

def _op_equals(actual, expected):
    return actual == expected

def _op_not_equals(actual, expected):
    return actual != expected

def _op_greater_than(actual, expected):
    return actual is not None and float(actual) > float(expected)

def _op_greater_than_or_equal(actual, expected):
    return actual is not None and float(actual) >= float(expected)

def _op_less_than(actual, expected):
    return actual is not None and float(actual) < float(expected)

def _op_less_than_or_equal(actual, expected):
    return actual is not None and float(actual) <= float(expected)

def _op_between(actual, expected):
    if actual is None or not isinstance(expected, list) or len(expected) != 2:
        return False
    return float(expected[0]) <= float(actual) <= float(expected[1])

def _op_in(actual, expected):
    if not isinstance(expected, list):
        return False
    return actual in expected

def _op_not_in(actual, expected):
    if not isinstance(expected, list):
        return True
    return actual not in expected

def _op_contains(actual, expected):
    return actual is not None and str(expected).lower() in str(actual).lower()


OPERATORS = {
    "equals": _op_equals,
    "not_equals": _op_not_equals,
    "greater_than": _op_greater_than,
    "greater_than_or_equal": _op_greater_than_or_equal,
    "less_than": _op_less_than,
    "less_than_or_equal": _op_less_than_or_equal,
    "between": _op_between,
    "in": _op_in,
    "not_in": _op_not_in,
    "contains": _op_contains,
}


# ── Context builder ─────────────────────────────────────────────────────────

def _parse_time_window(tw: str) -> timedelta:
    """Convert '1h', '24h', '7d', '30d', '90d' to timedelta."""
    if not tw:
        return timedelta(hours=24)
    num = int(tw[:-1])
    unit = tw[-1]
    if unit == "h":
        return timedelta(hours=num)
    elif unit == "d":
        return timedelta(days=num)
    return timedelta(hours=24)


def _compute_aggregates(db: Session, customer_id: str, account_id: str, time_window: str) -> dict:
    """Compute aggregate values over a time window for a customer."""
    delta = _parse_time_window(time_window)
    since = datetime.utcnow() - delta

    base_query = db.query(Transaction).filter(
        Transaction.customer_id == customer_id,
        Transaction.transaction_date >= since,
    )

    txn_count = base_query.count()
    txn_sum = base_query.with_entities(func.sum(Transaction.amount)).scalar() or 0

    cash_methods = ["cash_deposit", "cash_withdrawal"]
    cash_query = base_query.filter(Transaction.transaction_method.in_(cash_methods))
    cash_count = cash_query.count()
    cash_sum = cash_query.with_entities(func.sum(Transaction.amount)).scalar() or 0

    unique_counterparties = base_query.filter(Transaction.counterparty_account.isnot(None)).with_entities(
        func.count(func.distinct(Transaction.counterparty_account))
    ).scalar() or 0

    unique_channels = base_query.with_entities(
        func.count(func.distinct(Transaction.channel))
    ).scalar() or 0

    unique_locations = base_query.filter(Transaction.location_city.isnot(None)).with_entities(
        func.count(func.distinct(Transaction.location_city))
    ).scalar() or 0

    max_amount = base_query.with_entities(func.max(Transaction.amount)).scalar() or 0
    avg_amount = base_query.with_entities(func.avg(Transaction.amount)).scalar() or 0

    # Round amounts (ending in 000, i.e. multiples of 100000 paise = 1000 rupees)
    round_count = base_query.filter(Transaction.amount % 100000 == 0).count()

    return {
        "transaction_count": txn_count,
        "transaction_sum": txn_sum,
        "cash_transaction_count": cash_count,
        "cash_transaction_sum": cash_sum,
        "unique_counterparties": unique_counterparties,
        "unique_channels": unique_channels,
        "unique_locations": unique_locations,
        "max_transaction_amount": max_amount,
        "avg_transaction_amount": avg_amount,
        "round_amount_count": round_count,
    }


def _build_context(db: Session, txn: Transaction) -> dict:
    """Build the evaluation context for a transaction."""
    customer = db.query(Customer).filter(Customer.id == txn.customer_id).first()
    account = db.query(Account).filter(Account.id == txn.account_id).first()

    return {
        "transaction": {
            "amount": txn.amount,
            "channel": txn.channel,
            "transaction_method": txn.transaction_method,
            "transaction_type": txn.transaction_type,
            "location_city": txn.location_city,
            "location_country": txn.location_country,
            "counterparty_account": txn.counterparty_account,
            "counterparty_bank": txn.counterparty_bank,
            "ip_address": txn.ip_address,
            "device_id": txn.device_id,
            "description": txn.description,
        },
        "customer": {
            "risk_score": customer.risk_score if customer else 0,
            "risk_category": customer.risk_category if customer else "low",
            "customer_type": customer.customer_type if customer else "individual",
            "nationality": customer.nationality if customer else "IN",
            "pep_status": customer.pep_status if customer else False,
            "kyc_status": customer.kyc_status if customer else "pending",
            "occupation": customer.occupation if customer else "",
            "annual_income": customer.annual_income if customer else 0,
        },
        "account": {
            "account_type": account.account_type if account else "",
            "balance": account.balance if account else 0,
            "status": account.status if account else "active",
        },
    }


# ── Condition evaluator ─────────────────────────────────────────────────────

def _resolve_field(context: dict, aggregates: dict, field: str):
    """Resolve a dotted field path like 'transaction.amount' or 'aggregate.transaction_count'."""
    parts = field.split(".", 1)
    if len(parts) != 2:
        return None

    category, name = parts
    if category == "aggregate":
        return aggregates.get(name)
    elif category in context:
        return context[category].get(name)
    return None


def _evaluate_condition(condition: dict, context: dict, aggregates: dict) -> bool:
    """Recursively evaluate a condition node (supports AND/OR nesting)."""
    # Nested logic group
    if "logic" in condition and "conditions" in condition:
        logic = condition["logic"].upper()
        sub_conditions = condition["conditions"]

        if logic == "AND":
            return all(_evaluate_condition(c, context, aggregates) for c in sub_conditions)
        elif logic == "OR":
            return any(_evaluate_condition(c, context, aggregates) for c in sub_conditions)
        return False

    # Leaf condition
    field = condition.get("field", "")
    operator = condition.get("operator", "equals")
    expected = condition.get("value")

    actual = _resolve_field(context, aggregates, field)

    op_fn = OPERATORS.get(operator)
    if op_fn is None:
        return False

    try:
        return op_fn(actual, expected)
    except (TypeError, ValueError):
        return False


# ── Alert creation ──────────────────────────────────────────────────────────

def _create_alert(db: Session, rule: Rule, txn: Transaction, customer_name: str) -> Alert:
    """Create an alert from a matched rule."""
    actions = json.loads(rule.actions) if rule.actions else []
    priority = rule.severity
    alert_type = rule.category

    for action in actions:
        if action.get("action") == "create_alert":
            params = action.get("params", {})
            priority = params.get("priority", priority)
            alert_type = params.get("alert_type", alert_type)

    now = datetime.utcnow()
    sla_hours = {"critical": 4, "high": 24, "medium": 72, "low": 168}.get(priority, 72)
    alert_num = f"ALT-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

    alert = Alert(
        id=str(uuid.uuid4()),
        alert_number=alert_num,
        rule_id=rule.id,
        customer_id=txn.customer_id,
        account_id=txn.account_id,
        transaction_id=txn.id,
        alert_type=alert_type,
        priority=priority,
        risk_score=txn.risk_score or 0,
        status="new",
        title=f"{rule.description} - {customer_name}",
        description=f"Rule {rule.name} triggered for transaction {txn.transaction_ref}. {rule.description}",
        details=json.dumps({
            "rule": rule.name,
            "transaction_ref": txn.transaction_ref,
            "amount": txn.amount,
            "channel": txn.channel,
            "method": txn.transaction_method,
        }),
        sla_due_at=now + timedelta(hours=sla_hours),
        created_at=now,
    )
    db.add(alert)
    return alert


# ── Deduplication ───────────────────────────────────────────────────────────

def _is_duplicate(db: Session, rule_id: str, customer_id: str, window_hours: int = 1) -> bool:
    """Check if a similar alert already exists within the dedup window."""
    since = datetime.utcnow() - timedelta(hours=window_hours)
    existing = db.query(Alert).filter(
        Alert.rule_id == rule_id,
        Alert.customer_id == customer_id,
        Alert.created_at >= since,
    ).first()
    return existing is not None


# ── Risk scoring ────────────────────────────────────────────────────────────

def _calculate_risk_score(txn: Transaction, matched_rules: list[Rule], context: dict) -> float:
    """Calculate transaction risk score based on matched rules and context."""
    base_score = 10.0

    severity_weights = {"critical": 40, "high": 25, "medium": 15, "low": 5}
    rule_score = sum(severity_weights.get(r.severity, 5) for r in matched_rules)

    channel_weights = {"branch": 0, "atm": 5, "internet_banking": 3, "mobile_banking": 3, "swift": 10, "pos": 2, "api": 5}
    channel_score = channel_weights.get(txn.channel, 0)

    risk_weights = {"low": 0, "medium": 10, "high": 20, "very_high": 35}
    customer_score = risk_weights.get(context["customer"]["risk_category"], 0)

    total = base_score + rule_score + channel_score + customer_score
    return min(total, 100.0)


# ── Main entry point ────────────────────────────────────────────────────────

def evaluate_transaction(db: Session, txn: Transaction) -> dict:
    """
    Evaluate a transaction against all enabled rules.
    Returns a summary of matched rules, created alerts, and updated risk score.
    """
    rules = db.query(Rule).filter(Rule.is_enabled == True).order_by(Rule.priority).all()
    context = _build_context(db, txn)

    customer = db.query(Customer).filter(Customer.id == txn.customer_id).first()
    customer_name = customer.full_name if customer else "Unknown"

    matched_rules = []
    created_alerts = []
    aggregates_cache = {}

    for rule in rules:
        conditions = json.loads(rule.conditions) if rule.conditions else {}
        if not conditions:
            continue

        # Compute aggregates if needed (cache by time_window)
        tw = rule.time_window or "24h"
        if tw not in aggregates_cache:
            aggregates_cache[tw] = _compute_aggregates(db, txn.customer_id, txn.account_id, tw)
        aggregates = aggregates_cache[tw]

        if _evaluate_condition(conditions, context, aggregates):
            matched_rules.append(rule)

            # Dedup check
            if not _is_duplicate(db, rule.id, txn.customer_id):
                alert = _create_alert(db, rule, txn, customer_name)
                created_alerts.append(alert)

            # Update rule detection count
            rule.detection_count = (rule.detection_count or 0) + 1
            rule.last_triggered_at = datetime.utcnow()

            # Flag transaction
            txn.is_flagged = True
            if not txn.flag_reason:
                txn.flag_reason = rule.description

    # Calculate risk score
    risk_score = _calculate_risk_score(txn, matched_rules, context)
    txn.risk_score = risk_score

    # Update customer risk score (weighted rolling)
    if customer and matched_rules:
        adjustment = sum({"critical": 5, "high": 3, "medium": 1.5, "low": 0.5}.get(r.severity, 0) for r in matched_rules)
        customer.risk_score = min(100, (customer.risk_score or 10) + adjustment)
        if customer.risk_score >= 75:
            customer.risk_category = "very_high"
        elif customer.risk_score >= 50:
            customer.risk_category = "high"
        elif customer.risk_score >= 25:
            customer.risk_category = "medium"

    db.flush()

    return {
        "transaction_id": txn.id,
        "risk_score": risk_score,
        "rules_evaluated": len(rules),
        "rules_matched": len(matched_rules),
        "matched_rule_names": [r.name for r in matched_rules],
        "alerts_created": len(created_alerts),
        "alert_ids": [a.id for a in created_alerts],
        "is_flagged": txn.is_flagged,
    }
