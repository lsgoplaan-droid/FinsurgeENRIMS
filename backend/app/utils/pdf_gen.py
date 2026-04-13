"""
PDF generation utility using reportlab.
Converts regulatory document text into a properly formatted PDF.
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT


def _get_styles():
    """Return a dict of reusable paragraph styles."""
    base = getSampleStyleSheet()

    title = ParagraphStyle(
        "RegTitle",
        parent=base["Heading1"],
        fontSize=14,
        spaceAfter=4,
        spaceBefore=0,
        textColor=colors.HexColor("#1e3a5f"),
        fontName="Helvetica-Bold",
    )
    subtitle = ParagraphStyle(
        "RegSubtitle",
        parent=base["Normal"],
        fontSize=9,
        spaceAfter=2,
        textColor=colors.HexColor("#4a6741"),
        fontName="Helvetica",
    )
    section_header = ParagraphStyle(
        "SectionHeader",
        parent=base["Normal"],
        fontSize=9,
        spaceBefore=8,
        spaceAfter=2,
        textColor=colors.HexColor("#1e3a5f"),
        fontName="Helvetica-Bold",
        backColor=colors.HexColor("#e8f0f7"),
        borderPad=4,
        leftIndent=0,
        rightIndent=0,
    )
    field_label = ParagraphStyle(
        "FieldLabel",
        parent=base["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#555555"),
        fontName="Helvetica",
    )
    field_value = ParagraphStyle(
        "FieldValue",
        parent=base["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#111111"),
        fontName="Helvetica-Bold",
    )
    narrative = ParagraphStyle(
        "Narrative",
        parent=base["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#222222"),
        fontName="Helvetica",
        leading=13,
    )
    footer = ParagraphStyle(
        "Footer",
        parent=base["Normal"],
        fontSize=7,
        textColor=colors.HexColor("#888888"),
        fontName="Helvetica",
        alignment=TA_CENTER,
    )
    warning = ParagraphStyle(
        "Warning",
        parent=base["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#7a3000"),
        fontName="Helvetica",
        backColor=colors.HexColor("#fff3e0"),
        borderPad=4,
        leading=12,
    )

    return {
        "title": title,
        "subtitle": subtitle,
        "section_header": section_header,
        "field_label": field_label,
        "field_value": field_value,
        "narrative": narrative,
        "footer": footer,
        "warning": warning,
    }


def _hr():
    return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=4, spaceBefore=4)


def _section(title, styles):
    """Render a section divider with a shaded header."""
    return Paragraph(f"&nbsp;&nbsp;{title}", styles["section_header"])


def _field_row(label, value):
    """Return a 2-col table row for a label/value pair."""
    return [label, value]


def _fields_table(rows, styles):
    """Create a 2-column table of label/value rows."""
    data = [[
        Paragraph(lbl, styles["field_label"]),
        Paragraph(str(val), styles["field_value"])
    ] for lbl, val in rows]

    t = Table(data, colWidths=[4.5 * cm, 11.5 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#eeeeee")),
    ]))
    return t


def generate_ctr_pdf(data: dict, fmt: str) -> bytes:
    """Generate a CTR PDF in either RBI (India) or RMA (Bhutan) format."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = _get_styles()
    story = []

    if fmt == "rma":
        story.append(Paragraph("LARGE CURRENCY TRANSACTION REPORT (LCTR)", styles["title"]))
        story.append(Paragraph("Royal Monetary Authority of Bhutan &nbsp;|&nbsp; FIU-Bhutan", styles["subtitle"]))
        story.append(Paragraph("RMA AML/CFT Rules 2009 &mdash; Nu. 100,000 reporting threshold", styles["subtitle"]))
        story.append(Paragraph(f"Reference: {data.get('report_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))
        story.append(_hr())
        story.append(Spacer(1, 4))

        story.append(_section("FILING STATUS", styles))
        story.append(_fields_table([
            ("Report Number", data.get("report_number", "-")),
            ("Filing Status", (data.get("filing_status", "PENDING")).upper()),
            ("Filed Date", data.get("filed_at") or "PENDING"),
            ("Created", data.get("created_at", "-")),
        ], styles))
        story.append(Spacer(1, 6))

        story.append(_section("CUSTOMER IDENTIFICATION", styles))
        story.append(_fields_table([
            ("Customer Name", data.get("customer_name", "-")),
            ("CID Number", data.get("customer_number", "-")),
            ("Customer Type", data.get("customer_type", "Individual")),
            ("Address", data.get("address_bhutan", "-")),
        ], styles))
        story.append(Spacer(1, 6))

        story.append(_section("TRANSACTION DETAILS", styles))
        story.append(_fields_table([
            ("Amount (Nu.)", f"Nu. {data.get('amount_nu', 0):,.2f}"),
            ("INR Equivalent", f"INR {data.get('amount_inr', 0):,.2f}"),
            ("Reporting Threshold", "Nu. 100,000.00 (LCTR threshold)"),
            ("Reporting Window", "7 days from transaction date (RMA Rule 14)"),
            ("Transaction Date", data.get("transaction_date", "-")),
        ], styles))
        story.append(Spacer(1, 8))

        story.append(Paragraph(
            "This Large Currency Transaction Report is filed with FIU-Bhutan pursuant to RMA AML/CFT Rules 2009. "
            "Any tipping off of the customer is strictly prohibited. Retain records for 5 years.",
            styles["warning"]
        ))

    else:  # rbi / india
        story.append(Paragraph("CURRENCY TRANSACTION REPORT (CTR)", styles["title"]))
        story.append(Paragraph("Financial Intelligence Unit India (FIU-IND)", styles["subtitle"]))
        story.append(Paragraph("RBI Master Direction on KYC &mdash; INR 10 lakh reporting threshold", styles["subtitle"]))
        story.append(Paragraph(f"Reference: {data.get('report_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))
        story.append(_hr())
        story.append(Spacer(1, 4))

        story.append(_section("FILING STATUS", styles))
        story.append(_fields_table([
            ("Report Number", data.get("report_number", "-")),
            ("Filing Status", (data.get("filing_status", "PENDING")).upper()),
            ("Filed Date", data.get("filed_at") or "PENDING"),
            ("Created", data.get("created_at", "-")),
        ], styles))
        story.append(Spacer(1, 6))

        story.append(_section("CUSTOMER DETAILS", styles))
        story.append(_fields_table([
            ("Customer Name", data.get("customer_name", "-")),
            ("Customer Number", data.get("customer_number", "-")),
            ("PAN", data.get("pan", "Not on file")),
            ("Address", data.get("address_india", "-")),
        ], styles))
        story.append(Spacer(1, 6))

        story.append(_section("TRANSACTION DETAILS", styles))
        story.append(_fields_table([
            ("Amount", f"INR {data.get('amount_inr', 0):,.2f}"),
            ("Threshold", "INR 10,00,000.00 (mandatory CTR threshold)"),
            ("Reporting Window", "15 days from end of transaction month"),
            ("Transaction Date", data.get("transaction_date", "-")),
        ], styles))
        story.append(Spacer(1, 8))

        story.append(Paragraph(
            "Reported under RBI Master Direction on KYC and PMLA Section 12. "
            "This document is the canonical CTR filed with FIU-IND for regulatory archival.",
            styles["warning"]
        ))

    story.append(Spacer(1, 12))
    story.append(_hr())
    story.append(Paragraph(
        f"Downloaded by: {data.get('downloaded_by', '-')} &nbsp;&bull;&nbsp; {data.get('download_time', '-')} &nbsp;&bull;&nbsp; CONFIDENTIAL — FOR REGULATORY USE ONLY",
        styles["footer"]
    ))

    doc.build(story)
    return buf.getvalue()


def generate_sar_pdf(data: dict, fmt: str) -> bytes:
    """Generate a SAR/STR PDF in RBI or RMA format."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = _get_styles()
    story = []

    if fmt == "rma":
        story.append(Paragraph("SUSPICIOUS TRANSACTION REPORT (STR)", styles["title"]))
        story.append(Paragraph("Financial Intelligence Unit - Bhutan (FIU-Bhutan)", styles["subtitle"]))
        story.append(Paragraph("RMA AML/CFT Rules 2009, Section 11 &mdash; 7-day filing requirement", styles["subtitle"]))
        story.append(Paragraph(f"Reference: {data.get('report_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))
    else:
        story.append(Paragraph("SUSPICIOUS TRANSACTION REPORT (STR / SAR)", styles["title"]))
        story.append(Paragraph("Financial Intelligence Unit India (FIU-IND)", styles["subtitle"]))
        story.append(Paragraph("PMLA Rules 2005, Rule 7 &mdash; 7-day filing window", styles["subtitle"]))
        story.append(Paragraph(f"Reference: {data.get('report_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))

    story.append(_hr())
    story.append(Spacer(1, 4))

    story.append(_section("FILING STATUS", styles))
    story.append(_fields_table([
        ("Report Number", data.get("report_number", "-")),
        ("Filing Status", (data.get("filing_status", "PENDING")).upper()),
        ("Filed Date", data.get("filed_at") or "PENDING"),
    ], styles))
    story.append(Spacer(1, 6))

    id_label = "CID Number" if fmt == "rma" else "Customer Number"
    story.append(_section("SUBJECT (CUSTOMER) DETAILS", styles))
    story.append(_fields_table([
        ("Customer Name", data.get("customer_name", "-")),
        (id_label, data.get("customer_number", "-")),
        ("Customer Type", data.get("customer_type", "-")),
        ("PEP Status", "YES — Enhanced Due Diligence required" if data.get("pep") else "No"),
        ("Risk Score", f"{data.get('risk_score', '-')} / 100"),
        ("PAN", data.get("pan", "Not on file")) if fmt == "rbi" else ("Address", data.get("address_bhutan", "-")),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("SUSPICIOUS ACTIVITY DETAILS", styles))
    amt_line = (
        f"Nu. {data.get('amount_nu', 0):,.2f} (INR {data.get('amount_inr', 0):,.2f})"
        if fmt == "rma"
        else f"INR {data.get('amount_inr', 0):,.2f}"
    )
    story.append(_fields_table([
        ("Activity Type", data.get("activity_type", "-")),
        ("Total Amount", amt_line),
        ("Date Range", f"{data.get('date_from', '-')} to {data.get('date_to', '-')}"),
    ], styles))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Narrative / Findings:", styles["field_label"]))
    story.append(Paragraph(data.get("narrative", "See linked case file."), styles["narrative"]))
    story.append(Spacer(1, 8))

    story.append(_section("REGULATORY OBLIGATIONS", styles))
    if fmt == "rma":
        obligations = [
            "File with FIU-Bhutan within 7 days of suspicion (RMA AML/CFT Rules 2009, Section 11)",
            "Customer tipping-off strictly prohibited",
            "Preserve records for minimum 5 years",
            "Notify the Principal Officer of the institution",
        ]
    else:
        obligations = [
            "File this STR with FIU-IND within 7 days of suspicion (PMLA Rule 7)",
            "Restrict account operations pending investigation outcome",
            "Preserve all transaction records for minimum 5 years (PMLA Section 12)",
            "Notify the Principal Officer (PMLA Act 2002)",
        ]
    for ob in obligations:
        story.append(Paragraph(f"&bull; {ob}", styles["narrative"]))

    story.append(Spacer(1, 12))
    story.append(_hr())
    story.append(Paragraph(
        f"Downloaded by: {data.get('downloaded_by', '-')} &nbsp;&bull;&nbsp; {data.get('download_time', '-')} &nbsp;&bull;&nbsp; CONFIDENTIAL — FOR REGULATORY USE ONLY",
        styles["footer"]
    ))

    doc.build(story)
    return buf.getvalue()


def generate_lvtr_pdf(data: dict) -> bytes:
    """Generate an LVTR PDF (RMA/Bhutan format only)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = _get_styles()
    story = []

    story.append(Paragraph("LARGE VALUE TRANSACTION REPORT (LVTR)", styles["title"]))
    story.append(Paragraph("Financial Intelligence Unit - Bhutan (FIU-Bhutan)", styles["subtitle"]))
    story.append(Paragraph("RMA AML/CFT Rules 2009, Rule 14 &mdash; Nu. 100,000 threshold, 7-day window", styles["subtitle"]))
    story.append(Paragraph(f"Reference: {data.get('report_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))
    story.append(_hr())
    story.append(Spacer(1, 4))

    story.append(_section("FILING STATUS", styles))
    story.append(_fields_table([
        ("Report Number", data.get("report_number", "-")),
        ("Filing Status", (data.get("filing_status", "PENDING")).upper()),
        ("Filed Date", data.get("filed_at") or "PENDING"),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("REPORTING INSTITUTION", styles))
    story.append(_fields_table([
        ("Institution", "FinsurgeFRIMS Demo Bank (Bhutan)"),
        ("Branch", "Main Branch, Thimphu"),
        ("Regulator", "Royal Monetary Authority of Bhutan"),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("CUSTOMER DETAILS", styles))
    story.append(_fields_table([
        ("Full Name", data.get("customer_name", "-")),
        ("CID / Passport", data.get("customer_number", "-")),
        ("Customer Type", data.get("customer_type", "Individual")),
        ("PEP Status", "YES — Enhanced Due Diligence required" if data.get("pep") else "No"),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("TRANSACTION DETAILS", styles))
    story.append(_fields_table([
        ("Transaction Type", data.get("transaction_type", "-")),
        ("Amount (Nu.)", f"Nu. {data.get('amount_nu', 0):,.2f} (Ngultrum)"),
        ("INR Equivalent", f"INR {data.get('amount_inr', 0):,.2f}"),
        ("Transaction Date", data.get("transaction_date", "-")),
        ("Reporting Threshold", "Nu. 100,000.00"),
        ("Threshold Exceeded", "YES"),
        ("Filing Deadline", f"Within 7 days of transaction (RMA Rule 14)"),
    ], styles))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "Customer tipping-off strictly prohibited. Records to be retained for minimum 5 years. "
        "Principal Officer notification required per RMA AML/CFT Rules 2009.",
        styles["warning"]
    ))

    story.append(Spacer(1, 12))
    story.append(_hr())
    story.append(Paragraph(
        f"Downloaded by: {data.get('downloaded_by', '-')} &nbsp;&bull;&nbsp; {data.get('download_time', '-')} &nbsp;&bull;&nbsp; CONFIDENTIAL — FOR REGULATORY USE ONLY",
        styles["footer"]
    ))

    doc.build(story)
    return buf.getvalue()


def generate_fir_pdf(data: dict, fmt: str) -> bytes:
    """Generate a Police FIR PDF in India (IPC) or Bhutan (BPC) format."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = _get_styles()
    story = []

    if fmt == "bhutan":
        story.append(Paragraph("FIRST INFORMATION REPORT (FIR)", styles["title"]))
        story.append(Paragraph("Royal Bhutan Police (RBP) &nbsp;|&nbsp; Kingdom of Bhutan", styles["subtitle"]))
        story.append(Paragraph("Filed under Bhutan Penal Code 2004 (BPC 2004)", styles["subtitle"]))
        jurisdiction_label = "Thimphu District, Bhutan"
        law_ref_label = "BPC Section"
    else:
        story.append(Paragraph("FIRST INFORMATION REPORT (FIR)", styles["title"]))
        story.append(Paragraph("India Police &nbsp;|&nbsp; Republic of India", styles["subtitle"]))
        story.append(Paragraph("Filed under Indian Penal Code (IPC)", styles["subtitle"]))
        jurisdiction_label = data.get("jurisdiction", "India")
        law_ref_label = "IPC Section / Act"

    story.append(Paragraph(f"FIR Number: {data.get('fir_number', '-')} &nbsp;&nbsp; Generated: {data.get('generated', '-')}", styles["subtitle"]))
    story.append(_hr())
    story.append(Spacer(1, 4))

    story.append(_section("FIR DETAILS", styles))
    story.append(_fields_table([
        ("FIR Number", data.get("fir_number", "-")),
        ("Status", (data.get("status", "-")).upper()),
        ("Date Filed", data.get("filed_date", "-")),
        ("Jurisdiction", jurisdiction_label),
        (law_ref_label, data.get("law_ref" if fmt == "bhutan" else "ipc_section", "-")),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("COMPLAINANT (BANK)", styles))
    story.append(_fields_table([
        ("Institution", "FinsurgeFRIMS Demo Bank"),
        ("Branch", data.get("branch", "-")),
        ("Reporting Officer", data.get("reported_by", "-")),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("ACCUSED / SUBJECT", styles))
    story.append(_fields_table([
        ("Customer Name", data.get("customer_name", "-")),
        ("Customer ID", data.get("customer_id", "-")),
    ], styles))
    story.append(Spacer(1, 6))

    story.append(_section("OFFENSE DETAILS", styles))
    currency = "Nu." if fmt == "bhutan" else "INR"
    amount = data.get("amount_nu", data.get("amount_inr", 0)) if fmt == "bhutan" else data.get("amount_inr", 0)
    story.append(_fields_table([
        ("Offense Type", data.get("offense_type", "-")),
        ("Amount Involved", f"{currency} {amount:,.2f}"),
        ("Date of Offense", data.get("offense_date", "-")),
    ], styles))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Description of Offense:", styles["field_label"]))
    story.append(Paragraph(data.get("description", "-"), styles["narrative"]))
    story.append(Spacer(1, 12))

    story.append(_hr())
    story.append(Paragraph(
        f"Downloaded by: {data.get('downloaded_by', '-')} &nbsp;&bull;&nbsp; {data.get('download_time', '-')} &nbsp;&bull;&nbsp; CONFIDENTIAL — FOR OFFICIAL USE ONLY",
        styles["footer"]
    ))

    doc.build(story)
    return buf.getvalue()
