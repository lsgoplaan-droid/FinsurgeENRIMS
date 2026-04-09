"""
Application Metrics — Prometheus /metrics endpoint with business + technical metrics.
Covers M2 from production roadmap.
"""
from fastapi import APIRouter
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

router = APIRouter(tags=["Metrics"])

# ── Technical Metrics ──────────────────────────────────────────────────────
# (prometheus-fastapi-instrumentator handles request rate/latency/error rate automatically)

# ── Business Metrics (updated by other modules) ───────────────────────────

# Alert lifecycle
ALERTS_CREATED = Counter(
    "frims_alerts_created_total",
    "Total alerts created by the detection engine",
    ["severity", "rule_category"],
)
ALERTS_CLOSED = Counter(
    "frims_alerts_closed_total",
    "Total alerts closed",
    ["disposition"],  # true_positive, false_positive, inconclusive
)
ALERTS_OPEN = Gauge(
    "frims_alerts_open",
    "Current open alerts",
    ["severity"],
)

# Case lifecycle
CASES_CREATED = Counter(
    "frims_cases_created_total",
    "Total cases created",
    ["case_type", "priority"],
)
CASES_OPEN = Gauge(
    "frims_cases_open",
    "Current open cases",
)

# STR/CTR filing
REPORTS_FILED = Counter(
    "frims_reports_filed_total",
    "Regulatory reports filed with FIU-IND",
    ["report_type"],  # CTR, STR
)
REPORTS_PENDING = Gauge(
    "frims_reports_pending",
    "Regulatory reports pending filing",
    ["report_type"],
)

# Rules engine
RULES_EVALUATED = Counter(
    "frims_rules_evaluated_total",
    "Total rule evaluations",
    ["category"],
)
RULES_TRIGGERED = Counter(
    "frims_rules_triggered_total",
    "Rules that matched and generated alerts",
    ["rule_id", "category"],
)

# Transaction throughput
TRANSACTIONS_PROCESSED = Counter(
    "frims_transactions_processed_total",
    "Total transactions processed",
    ["channel"],
)
TRANSACTIONS_FLAGGED = Counter(
    "frims_transactions_flagged_total",
    "Transactions flagged as suspicious",
)

# SLA
SLA_BREACHES = Counter(
    "frims_sla_breaches_total",
    "SLA breaches by severity",
    ["severity"],
)

# Auth
LOGIN_ATTEMPTS = Counter(
    "frims_login_attempts_total",
    "Login attempts",
    ["result"],  # success, failure
)


@router.get("/metrics", include_in_schema=False)
def metrics_endpoint():
    """Prometheus scrape endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
