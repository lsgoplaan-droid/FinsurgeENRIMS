from pydantic import BaseModel


class ExecutiveDashboard(BaseModel):
    total_alerts_today: int = 0
    open_cases: int = 0
    high_risk_customers: int = 0
    suspicious_transactions: int = 0
    alerts_by_priority: dict = {}
    alerts_by_type: dict = {}
    alerts_trend: list[dict] = []
    cases_by_status: dict = {}
    risk_distribution: dict = {}
    channel_analytics: dict = {}
    recent_alerts: list[dict] = []
    top_risk_customers: list[dict] = []
    analyst_workload: list[dict] = []
    sla_compliance: dict = {}
    monthly_stats: list[dict] = []


class OperationalDashboard(BaseModel):
    analyst_productivity: list[dict] = []
    sla_overview: dict = {}
    alert_volumes: dict = {}
    case_volumes: dict = {}
    avg_resolution_time: dict = {}


class RiskHeatmapData(BaseModel):
    channels: list[str] = []
    risk_levels: list[str] = []
    data: list[list[int]] = []
