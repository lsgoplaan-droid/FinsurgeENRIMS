"""
Board Report PDF Generator — One-click branded PDF export for CRO/Board presentations.
Includes: executive summary, risk metrics, alert trends, top cases, regulatory status.
"""
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Case, Customer, Transaction, User, CTRReport, SARReport

router = APIRouter(prefix="/reports", tags=["Reports"])

# Brand colors
BRAND_NAVY = colors.HexColor("#0f172a")
BRAND_BLUE = colors.HexColor("#1e40af")
BRAND_LIGHT = colors.HexColor("#f1f5f9")
BRAND_RED = colors.HexColor("#dc2626")
BRAND_AMBER = colors.HexColor("#d97706")
BRAND_GREEN = colors.HexColor("#16a34a")
WHITE = colors.white


def _styles():
    """Custom paragraph styles for the report."""
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("ReportTitle", parent=base["Title"], fontSize=22, textColor=BRAND_NAVY, spaceAfter=4),
        "subtitle": ParagraphStyle("ReportSubtitle", parent=base["Normal"], fontSize=11, textColor=colors.HexColor("#64748b"), spaceAfter=16),
        "h2": ParagraphStyle("SectionH2", parent=base["Heading2"], fontSize=14, textColor=BRAND_NAVY, spaceBefore=16, spaceAfter=8, borderWidth=0),
        "body": ParagraphStyle("BodyText", parent=base["Normal"], fontSize=10, textColor=colors.HexColor("#334155"), leading=14),
        "metric_label": ParagraphStyle("MetricLabel", parent=base["Normal"], fontSize=8, textColor=colors.HexColor("#64748b"), alignment=TA_CENTER),
        "metric_value": ParagraphStyle("MetricValue", parent=base["Normal"], fontSize=18, textColor=BRAND_NAVY, alignment=TA_CENTER, fontName="Helvetica-Bold"),
        "footer": ParagraphStyle("Footer", parent=base["Normal"], fontSize=7, textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER),
        "cell": ParagraphStyle("Cell", parent=base["Normal"], fontSize=9, textColor=colors.HexColor("#334155"), leading=12),
        "cell_bold": ParagraphStyle("CellBold", parent=base["Normal"], fontSize=9, textColor=BRAND_NAVY, fontName="Helvetica-Bold", leading=12),
    }
    return styles


def _format_inr(paise: int) -> str:
    """Format paise amount to INR string with lakhs/crores."""
    rupees = abs(paise) / 100
    if rupees >= 10_000_000:
        return f"INR {rupees / 10_000_000:.2f} Cr"
    elif rupees >= 100_000:
        return f"INR {rupees / 100_000:.2f} L"
    else:
        return f"INR {rupees:,.0f}"


def _status_text(status: str) -> str:
    return status.replace("_", " ").title()


def _build_kpi_table(data: list[tuple[str, str, str]], styles: dict):
    """Build a 1-row table of KPI cards."""
    label_cells = []
    value_cells = []
    change_cells = []
    for label, value, change in data:
        label_cells.append(Paragraph(label, styles["metric_label"]))
        value_cells.append(Paragraph(str(value), styles["metric_value"]))
        change_cells.append(Paragraph(change, styles["metric_label"]))

    col_width = (A4[0] - 40 * mm) / len(data)
    t = Table([value_cells, label_cells, change_cells], colWidths=[col_width] * len(data))
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def _build_data_table(headers: list[str], rows: list[list], styles: dict, col_widths=None):
    """Build a styled data table."""
    header_row = [Paragraph(f"<b>{h}</b>", styles["cell_bold"]) for h in headers]
    data_rows = []
    for row in rows:
        data_rows.append([Paragraph(str(c), styles["cell"]) for c in row])

    t = Table([header_row] + data_rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BRAND_LIGHT]),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


@router.get("/board-report")
def generate_board_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a branded Board Report PDF with live data."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)
    styles = _styles()

    # ── Gather data ──────────────────────────────────────────────────────
    # KPIs
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    open_alerts = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    alerts_today = db.query(func.count(Alert.id)).filter(Alert.created_at >= today_start).scalar() or 0
    open_cases = db.query(func.count(Case.id)).filter(
        Case.status.in_(["assigned", "under_investigation", "escalated", "open", "pending_regulatory", "new"])
    ).scalar() or 0
    total_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 1
    high_risk = db.query(func.count(Customer.id)).filter(
        Customer.is_active == True, Customer.risk_category.in_(["high", "very_high"])
    ).scalar() or 0
    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    sla_pct = round((1 - overdue_alerts / max(open_alerts, 1)) * 100, 1) if open_alerts else 100.0

    # Risk distribution
    risk_dist = dict(
        db.query(Customer.risk_category, func.count(Customer.id))
        .filter(Customer.is_active == True)
        .group_by(Customer.risk_category).all()
    )

    # Alerts by priority
    alerts_by_priority = dict(
        db.query(Alert.priority, func.count(Alert.id))
        .filter(~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .group_by(Alert.priority).all()
    )

    # 30-day alert trend (weekly buckets)
    weekly_trend = []
    for i in range(3, -1, -1):
        week_start = now - timedelta(days=(i + 1) * 7)
        week_end = now - timedelta(days=i * 7)
        count = db.query(func.count(Alert.id)).filter(
            and_(Alert.created_at >= week_start, Alert.created_at < week_end)
        ).scalar() or 0
        weekly_trend.append((week_start.strftime("%d %b"), week_end.strftime("%d %b"), count))

    # Top cases
    top_cases = (
        db.query(Case)
        .filter(Case.status.in_(["assigned", "under_investigation", "escalated", "open", "pending_regulatory", "new"]))
        .order_by(Case.priority.asc(), Case.created_at.desc())
        .limit(10)
        .all()
    )

    # Top risk customers
    top_risk_customers = (
        db.query(Customer)
        .filter(Customer.is_active == True)
        .order_by(Customer.risk_score.desc())
        .limit(10)
        .all()
    )

    # Regulatory reports
    ctrs_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    ctrs_pending = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status != "filed").scalar() or 0
    sars_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0
    sars_pending = db.query(func.count(SARReport.id)).filter(SARReport.filing_status != "filed").scalar() or 0

    # Transaction volume
    txn_volume_30d = db.query(func.sum(Transaction.amount)).filter(
        Transaction.transaction_date >= thirty_days_ago
    ).scalar() or 0
    flagged_volume_30d = db.query(func.sum(Transaction.amount)).filter(
        Transaction.transaction_date >= thirty_days_ago, Transaction.is_flagged == True
    ).scalar() or 0
    txn_count_30d = db.query(func.count(Transaction.id)).filter(
        Transaction.transaction_date >= thirty_days_ago
    ).scalar() or 0

    # PEP exposure
    pep_count = db.query(func.count(Customer.id)).filter(Customer.is_active == True, Customer.pep_status == True).scalar() or 0

    # ── Build PDF ────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )

    story = []

    # Header
    story.append(Paragraph("FinsurgeFRIMS", styles["title"]))
    story.append(Paragraph(
        f"Board Risk Report &nbsp;|&nbsp; Generated {now.strftime('%d %B %Y, %H:%M UTC')} &nbsp;|&nbsp; Prepared by {current_user.full_name}",
        styles["subtitle"],
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_BLUE, spaceAfter=12))

    # ── Section 1: Executive Summary KPIs ────────────────────────────────
    story.append(Paragraph("1. Executive Summary", styles["h2"]))

    high_risk_pct = round(high_risk / total_customers * 100, 1)
    kpi_data = [
        ("Open Alerts", str(open_alerts), f"Today: {alerts_today}"),
        ("Open Cases", str(open_cases), f"Overdue: {overdue_alerts}"),
        ("High-Risk Customers", str(high_risk), f"{high_risk_pct}% of portfolio"),
        ("SLA Compliance", f"{sla_pct}%", f"{overdue_alerts} overdue"),
    ]
    story.append(_build_kpi_table(kpi_data, styles))
    story.append(Spacer(1, 12))

    # Narrative
    narrative = (
        f"As of {now.strftime('%d %B %Y')}, the bank monitors <b>{total_customers}</b> active customers "
        f"with <b>{txn_count_30d:,}</b> transactions processed in the last 30 days "
        f"(volume: {_format_inr(txn_volume_30d)}). "
        f"Of these, flagged suspicious transactions total {_format_inr(flagged_volume_30d)}. "
        f"<b>{high_risk}</b> customers ({high_risk_pct}%) are rated high or very-high risk. "
        f"PEP exposure stands at <b>{pep_count}</b> customers. "
        f"SLA compliance is at <b>{sla_pct}%</b> with {overdue_alerts} alerts past their resolution deadline."
    )
    story.append(Paragraph(narrative, styles["body"]))
    story.append(Spacer(1, 8))

    # ── Section 2: Risk Distribution ─────────────────────────────────────
    story.append(Paragraph("2. Portfolio Risk Distribution", styles["h2"]))

    risk_order = ["low", "medium", "high", "very_high"]
    risk_rows = []
    for cat in risk_order:
        count = risk_dist.get(cat, 0)
        pct = round(count / total_customers * 100, 1) if total_customers else 0
        risk_rows.append([_status_text(cat), str(count), f"{pct}%"])

    page_w = A4[0] - 40 * mm
    story.append(_build_data_table(
        ["Risk Category", "Customers", "% of Portfolio"],
        risk_rows, styles,
        col_widths=[page_w * 0.4, page_w * 0.3, page_w * 0.3],
    ))
    story.append(Spacer(1, 8))

    # ── Section 3: Alert Overview ────────────────────────────────────────
    story.append(Paragraph("3. Alert Overview", styles["h2"]))

    # Alerts by priority table
    priority_order = ["critical", "high", "medium", "low"]
    alert_rows = []
    for p in priority_order:
        alert_rows.append([_status_text(p), str(alerts_by_priority.get(p, 0))])
    story.append(_build_data_table(
        ["Priority", "Open Alerts"],
        alert_rows, styles,
        col_widths=[page_w * 0.5, page_w * 0.5],
    ))
    story.append(Spacer(1, 8))

    # Weekly trend
    story.append(Paragraph("<b>Weekly Alert Trend (Last 4 Weeks)</b>", styles["body"]))
    trend_rows = [[f"{s} — {e}", str(c)] for s, e, c in weekly_trend]
    story.append(_build_data_table(
        ["Week", "New Alerts"],
        trend_rows, styles,
        col_widths=[page_w * 0.6, page_w * 0.4],
    ))
    story.append(Spacer(1, 8))

    # ── Section 4: Top Active Cases ──────────────────────────────────────
    story.append(Paragraph("4. Top Active Cases", styles["h2"]))

    case_rows = []
    for c in top_cases:
        cust = db.query(Customer).filter(Customer.id == c.customer_id).first()
        assignee = db.query(User).filter(User.id == c.assigned_to).first() if c.assigned_to else None
        case_rows.append([
            c.case_number,
            _status_text(c.priority),
            _status_text(c.status),
            cust.full_name if cust else "-",
            assignee.full_name if assignee else "Unassigned",
            _format_inr(c.total_suspicious_amount or 0),
        ])
    if case_rows:
        story.append(_build_data_table(
            ["Case #", "Priority", "Status", "Customer", "Assigned To", "Amount"],
            case_rows, styles,
            col_widths=[page_w * 0.15, page_w * 0.12, page_w * 0.15, page_w * 0.22, page_w * 0.2, page_w * 0.16],
        ))
    else:
        story.append(Paragraph("No active cases.", styles["body"]))
    story.append(Spacer(1, 8))

    # ── Section 5: Top Risk Customers ────────────────────────────────────
    story.append(Paragraph("5. Top Risk Customers", styles["h2"]))

    cust_rows = []
    for c in top_risk_customers:
        cust_rows.append([
            c.customer_number,
            c.full_name,
            _status_text(c.risk_category or "low"),
            f"{c.risk_score or 0:.0f}",
            "Yes" if c.pep_status else "No",
            c.city or "-",
        ])
    story.append(_build_data_table(
        ["CIF", "Name", "Risk Level", "Score", "PEP", "Location"],
        cust_rows, styles,
        col_widths=[page_w * 0.12, page_w * 0.25, page_w * 0.15, page_w * 0.1, page_w * 0.1, page_w * 0.28],
    ))
    story.append(Spacer(1, 8))

    # ── Section 6: Regulatory Filing Status ──────────────────────────────
    story.append(Paragraph("6. Regulatory Filing Status", styles["h2"]))

    reg_rows = [
        ["Currency Transaction Reports (CTR)", str(ctrs_filed), str(ctrs_pending)],
        ["Suspicious Activity Reports (SAR)", str(sars_filed), str(sars_pending)],
    ]
    story.append(_build_data_table(
        ["Report Type", "Filed", "Pending"],
        reg_rows, styles,
        col_widths=[page_w * 0.5, page_w * 0.25, page_w * 0.25],
    ))
    story.append(Spacer(1, 8))

    compliance_note = (
        f"RBI Compliance: CTR auto-filing is active for transactions exceeding INR 10,00,000. "
        f"SAR reports require principal officer review before filing with FIU-IND. "
        f"Current backlog: <b>{ctrs_pending}</b> CTRs and <b>{sars_pending}</b> SARs pending review."
    )
    story.append(Paragraph(compliance_note, styles["body"]))
    story.append(Spacer(1, 16))

    # ── Footer / Disclaimer ──────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    story.append(Paragraph(
        "CONFIDENTIAL — This report is generated by FinsurgeFRIMS for internal use only. "
        "Do not distribute outside the organization without written approval from the Chief Risk Officer.",
        styles["footer"],
    ))
    story.append(Paragraph(
        f"Report ID: BOARD-{now.strftime('%Y%m%d-%H%M%S')} &nbsp;|&nbsp; FinsurgeFRIMS v1.0 &nbsp;|&nbsp; Page 1",
        styles["footer"],
    ))

    # Build
    doc.build(story)
    buf.seek(0)

    filename = f"FinsurgeFRIMS_Board_Report_{now.strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
