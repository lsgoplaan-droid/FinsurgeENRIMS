from fastapi import APIRouter
from app.api import (
    auth, customers, transactions, alerts, cases, rules, kyc, watchlists,
    network, dashboard, reports, admin, integrations, workflows, features,
    internal_fraud, fraud_scenarios, ai_agent, mis_reports, compliance_sar, fraud_detection, fraud_metrics,
    board_report, alert_tuning, sla_burndown,
    police_fir, notification_rules, system_monitoring, rules_management,
    compliance_scorecard, filing_deadlines, audit_trail, user_activity,
    metrics, str_workflow, data_localization, evidence, sms_approval, ubo,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(transactions.router)
api_router.include_router(alerts.router)
api_router.include_router(cases.router)
api_router.include_router(rules.router)
api_router.include_router(kyc.router)
api_router.include_router(watchlists.router)
api_router.include_router(network.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(integrations.router)
api_router.include_router(workflows.router)
api_router.include_router(features.router)
api_router.include_router(internal_fraud.router)
api_router.include_router(fraud_scenarios.router)
api_router.include_router(ai_agent.router)
api_router.include_router(mis_reports.router)
api_router.include_router(compliance_sar.router)
api_router.include_router(fraud_detection.router)
api_router.include_router(fraud_metrics.router)
api_router.include_router(board_report.router)
api_router.include_router(alert_tuning.router)
api_router.include_router(sla_burndown.router)
api_router.include_router(police_fir.router)
api_router.include_router(notification_rules.router)
api_router.include_router(system_monitoring.router)
api_router.include_router(rules_management.router)
api_router.include_router(compliance_scorecard.router)
api_router.include_router(filing_deadlines.router)
api_router.include_router(audit_trail.router)
api_router.include_router(user_activity.router)
api_router.include_router(metrics.router)
api_router.include_router(str_workflow.router)
api_router.include_router(data_localization.router)
api_router.include_router(evidence.router)
api_router.include_router(sms_approval.router)
api_router.include_router(ubo.router)
