from fastapi import APIRouter
from app.api import auth, customers, transactions, alerts, cases, rules, kyc, watchlists, network, dashboard, reports, admin, integrations

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
