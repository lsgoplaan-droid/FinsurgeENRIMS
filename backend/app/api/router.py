from fastapi import APIRouter
from app.api import (
    auth, customers, transactions, alerts, cases, rules, kyc, watchlists,
    network, dashboard, reports, admin, integrations, workflows, features,
    internal_fraud, fraud_scenarios, ai_agent, mis_reports, compliance_sar,
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
