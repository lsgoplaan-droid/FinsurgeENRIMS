from app.models.user import User, Role, user_roles
from app.models.customer import Customer
from app.models.account import Account, AccountHolder
from app.models.transaction import Transaction
from app.models.rule import Rule, Scenario
from app.models.alert import Alert, AlertNote
from app.models.case import Case, CaseEvidence, CaseActivity, case_alerts
from app.models.kyc import KYCReview, KYCDocument, ScreeningResult
from app.models.watchlist import WatchlistEntry
from app.models.report import CTRReport, SARReport
from app.models.network import CustomerRelationship, CustomerLink
from app.models.audit import AuditLog, SystemConfig, Notification
from app.models.employee_activity import EmployeeActivity
from app.models.police_fir import PoliceFIR, FIRActivity
from app.models.notification_rule import NotificationRule, NotificationLog
from app.services.maker_checker import PendingAction


def _register_all_models():
    """Import all models so SQLAlchemy knows about them."""
    pass


__all__ = [
    "User", "Role", "user_roles",
    "Customer",
    "Account", "AccountHolder",
    "Transaction",
    "Rule", "Scenario",
    "Alert", "AlertNote",
    "Case", "CaseEvidence", "CaseActivity", "case_alerts",
    "KYCReview", "KYCDocument", "ScreeningResult",
    "WatchlistEntry",
    "CTRReport", "SARReport",
    "CustomerRelationship", "CustomerLink",
    "AuditLog", "SystemConfig", "Notification",
    "EmployeeActivity",
    "PoliceFIR", "FIRActivity",
    "NotificationRule", "NotificationLog",
    "PendingAction",
]
