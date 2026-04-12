from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import MSO_ANCHOR
from pptx.dml.color import RGBColor

# Finsurge brand colors
NAVY_BLUE = RGBColor(31, 67, 128)      # #1F4380
PURPLE = RGBColor(163, 31, 104)        # #A31F68
ACCENT_PINK = RGBColor(234, 61, 117)   # #EA3D75
WHITE = RGBColor(255, 255, 255)
LIGHT_GRAY = RGBColor(245, 246, 248)   # #F5F6F8
DARK_GRAY = RGBColor(55, 65, 81)       # #374151

def add_logo(slide, logo_path):
    """Add Finsurge logo to top-right"""
    left = Inches(8.8)
    top = Inches(0.3)
    height = Inches(0.6)
    slide.shapes.add_picture(logo_path, left, top, height=height)

def add_title_slide(prs, title, subtitle, logo_path):
    """Professional title slide"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # Background: Navy blue
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = NAVY_BLUE

    # Add Finsurge logo
    add_logo(slide, logo_path)

    # Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(2.5), Inches(8), Inches(1.5))
    title_frame = title_box.text_frame
    title_frame.word_wrap = True
    p = title_frame.paragraphs[0]
    p.text = title
    p.font.size = Pt(60)
    p.font.bold = True
    p.font.color.rgb = WHITE

    # Subtitle
    subtitle_box = slide.shapes.add_textbox(Inches(0.8), Inches(4.2), Inches(8), Inches(2))
    subtitle_frame = subtitle_box.text_frame
    subtitle_frame.word_wrap = True
    p = subtitle_frame.paragraphs[0]
    p.text = subtitle
    p.font.size = Pt(24)
    p.font.color.rgb = ACCENT_PINK

    # Tagline
    tagline_box = slide.shapes.add_textbox(Inches(0.8), Inches(6.5), Inches(8), Inches(0.8))
    tagline_frame = tagline_box.text_frame
    p = tagline_frame.paragraphs[0]
    p.text = "Enterprise Risk Management System for Indian & Bhutanese Banking"
    p.font.size = Pt(16)
    p.font.italic = True
    p.font.color.rgb = RGBColor(200, 200, 200)

def add_content_slide(prs, title, content_items, logo_path):
    """Professional content slide with McKinsey styling"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # White background
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = WHITE

    # Top bar (navy blue accent)
    top_bar = slide.shapes.add_shape(1, Inches(0), Inches(0), Inches(10), Inches(0.08))
    top_bar.fill.solid()
    top_bar.fill.fore_color.rgb = NAVY_BLUE
    top_bar.line.color.rgb = NAVY_BLUE

    # Add logo
    add_logo(slide, logo_path)

    # Title with accent line
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(8.2), Inches(0.95))
    title_frame = title_box.text_frame
    title_frame.word_wrap = True
    title_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = title_frame.paragraphs[0]
    p.text = title
    p.font.size = Pt(38)
    p.font.bold = True
    p.font.color.rgb = NAVY_BLUE

    # Accent line under title
    line = slide.shapes.add_connector(1, Inches(0.8), Inches(1.4), Inches(3.5), Inches(1.4))
    line.line.color.rgb = ACCENT_PINK
    line.line.width = Pt(4)

    # Content box
    content_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.75), Inches(8.4), Inches(5.25))
    text_frame = content_box.text_frame
    text_frame.word_wrap = True
    text_frame.vertical_anchor = MSO_ANCHOR.TOP

    for i, item in enumerate(content_items):
        if i > 0:
            text_frame.add_paragraph()
        p = text_frame.paragraphs[i]

        # Check if it's a sub-item (starts with 4 spaces)
        if item.startswith("    "):
            p.text = item.strip()
            p.font.size = Pt(16)
            p.level = 1
        else:
            p.text = item
            p.font.size = Pt(18)
            p.level = 0

        p.font.color.rgb = DARK_GRAY
        p.space_before = Pt(6)
        p.space_after = Pt(6)

        # Bold first part before dash for sub-items
        if " — " in p.text:
            runs = p.runs
            if runs:
                parts = p.text.split(" — ")
                if len(parts) == 2:
                    p.text = ""
                    run1 = p.add_run()
                    run1.text = parts[0]
                    run1.font.bold = True
                    run2 = p.add_run()
                    run2.text = " — " + parts[1]

# Create presentation
prs = Presentation()
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)

logo_path = r"d:\Users\lsgop\Downloads\finsurgelogo.png"

# Slide 1: Title
add_title_slide(prs, "FinsurgeENRIMS", "Real-Time Fraud Detection & Risk Management", logo_path)

# Slide 2: System Overview
add_content_slide(prs, "System Overview", [
    "Real-time detection of fraud, cyber attacks, and regulatory violations for Indian & Bhutanese banks",
    "77 detection rules organized into 17 detection scenarios covering:",
    "    Fraud patterns (card fraud, account takeover, behavioral anomalies, mule accounts)",
    "    Cyber threats (SIM swap, phishing, UPI fraud, digital channel attacks)",
    "    Advanced fraud (AI deepfakes, synthetic identities, bot detection)",
    "    Internal fraud (employee abuse, data theft)",
    "Customer 360° unified view with network relationship analysis and risk screening",
    "Alert-to-case-to-investigation workflow with SLA tracking and AI-powered investigation copilot"
], logo_path)

# Slide 3: Multi-Regulator Compliance
add_content_slide(prs, "Multi-Regulator Compliance Framework", [
    "Dual compliance scorecard: RBI (India) + RMA (Bhutan) requirements",
    "RBI Compliance (India)",
    "    4 sections covering fraud risk, data governance, reporting, IT security",
    "    16 requirements auto-tracked with live system metrics",
    "RMA Compliance (Bhutan)",
    "    3 sections covering AML/CFT, regulatory reporting, corporate governance",
    "    14 requirements including CDD, EDD, sanctions screening, STR filing",
    "Integrated risk scoring with multi-jurisdictional support",
    "Automatic compliance assessment with coverage metrics"
], logo_path)

# Slide 4: RMA AML/CFT Controls
add_content_slide(prs, "RMA AML/CFT Compliance (Bhutan)", [
    "Comprehensive Anti-Money Laundering & Counter-Financing of Terrorism controls",
    "Customer Due Diligence (CDD) & Enhanced Due Diligence (EDD)",
    "    Full KYC verification at account opening with document validation",
    "    Automated PEP screening for politically exposed persons",
    "    Ultimate Beneficial Owner (UBO) identification and verification",
    "Ongoing Transaction Monitoring",
    "    Real-time screening of all transactions against risk patterns",
    "    Sanctions screening against OFAC, UN, and FATF watchlists",
    "Suspicious Transaction Reporting (STR) to FIU-Bhutan within 7 days"
], logo_path)

# Slide 5: RMA Regulatory Reporting
add_content_slide(prs, "RMA Regulatory Reporting & LVTR", [
    "Automated filing with RMA and Financial Intelligence Unit - Bhutan",
    "Suspicious Transaction Reporting (STR)",
    "    Integrated STR workflow with 7-day filing deadline to FIU-Bhutan",
    "    Comprehensive case documentation and investigation tracking",
    "Large Value Transaction Reporting (LVTR)",
    "    Track and report transactions exceeding Nu. 100,000 threshold",
    "    Full transaction records maintained for 5-year RMA requirement",
    "Annual AML/CFT Compliance Report",
    "    Board-level reporting with metrics and incident summary"
], logo_path)

# Slide 6: Compliance Scorecard Dashboard
add_content_slide(prs, "Compliance Scorecard — Live Metrics", [
    "Real-time compliance tracking with auto-calculated scores",
    "RBI Scorecard: 16 requirements across 4 sections",
    "    Fraud Risk Management, Data Governance, Reporting, IT Security",
    "RMA Scorecard: 14 requirements across 3 sections",
    "    AML/CFT, Regulatory Reporting, Corporate Governance",
    "Each requirement shows:",
    "    Status: Compliant / Partial / At-Risk / Not Implemented",
    "    Coverage %: Based on actual system state and metrics",
    "    Evidence: Specific data supporting compliance status"
], logo_path)

# Slide 7: Alert Management & Investigation
add_content_slide(prs, "Investigation & Case Management", [
    "Complete alert lifecycle with SLA enforcement and intelligent routing",
    "Alert States: New → Assigned → Under Review → Escalated → Closed",
    "Severity-Based SLAs: Critical (4h), High (24h), Medium (72h), Low (168h)",
    "Intelligent Auto-Assignment: Routes alerts to available analysts by skill, workload",
    "Investigation Features",
    "    Add detailed notes, attach evidence documents, link related cases",
    "    Bulk actions: Close false positives, escalate groups, reassign batches",
    "Dashboard Analytics: New alerts trending, SLA compliance %, closure patterns"
], logo_path)

# Slide 8: Case Management & Document Downloads
add_content_slide(prs, "Case Management & Document Downloads", [
    "Consolidate related alerts and evidence into formal investigation cases",
    "Document Generation & Download",
    "    Police FIR — Download full investigation report with all case details",
    "    CTR/SAR Filings — Download regulatory reports for archival or reprint",
    "    Generate formatted .txt documents suitable for filing and compliance",
    "Evidence Management: Attach documents, screenshots, transaction exports",
    "Case Types: Fraud, Cyber Attack, Money Laundering, Operational Risk, Internal Misconduct",
    "Case Lifecycle: Open → Assigned → Under Investigation → Escalated → Closed"
], logo_path)

# Slide 9: Regulatory Filing & Dashboard
add_content_slide(prs, "Regulatory Filing & Real-Time Monitoring", [
    "Automated filing workflow with document generation and downloads",
    "CTR/SAR Filings: Download reports with complete filing details",
    "FIR Management: File reports with police, track progress, download documents",
    "Executive visibility into risk management operations",
    "Key Performance Indicators (Real-Time)",
    "    New alerts (24h), Overdue alerts, New cases, Closure rate, SLA compliance %",
    "Operational Dashboards",
    "    Alert heatmap by hour, customer segment, rule category",
    "    Team workload and case resolution metrics"
], logo_path)

# Slide 10: Audit Trail & Security
add_content_slide(prs, "Audit Trail, Security & Governance", [
    "Immutable audit logging for regulatory compliance (RBI + RMA requirements)",
    "Audit Coverage",
    "    Detection: Rule creation, alert generation, escalation triggers",
    "    Investigation: Case creation, evidence, notes, disposition",
    "    Access: User login, data access, rule changes, document downloads",
    "    Retention: 5 years (RBI/RMA mandate) for audit logs, 7 years transaction data",
    "Security Controls",
    "    Role-Based Access with least privilege; JWT-based authentication",
    "    Data Protection: PII encryption, API response masking, HTTPS-only",
    "    Compliance Ready: Meets RBI Master Direction, RMA AML/CFT Rules"
], logo_path)

# Save
prs.save("FinsurgeENRIMS_MultiRegulator_RMA.pptx")
print("[OK] Multi-regulator PowerPoint created: FinsurgeENRIMS_MultiRegulator_RMA.pptx")
print("[FEATURE] Added RMA (Bhutan) compliance scorecard")
print("[FEATURE] Multi-regulator support: RBI (India) + RMA (Bhutan)")
print("[UPDATE] 10 slides covering fraud detection + compliance for both jurisdictions")
