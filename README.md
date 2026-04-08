# FinsurgeENRIMS - Enterprise Risk Management System

A comprehensive Enterprise Fraud & Risk Management platform for banking institutions.

## Features

- **Real-Time Transaction Monitoring** - Cross-channel monitoring across ATM, Branch, Mobile, Internet Banking, POS, SWIFT
- **Anti-Money Laundering (AML)** - Structuring, layering, round-tripping, geographic anomaly detection
- **Enterprise Fraud Management** - Card fraud, identity fraud, account takeover, wire fraud detection
- **KYC / Customer Due Diligence** - Onboarding risk assessment, PEP/sanctions screening, periodic reviews
- **Rules Engine** - 26 pre-built detection rules with configurable AND/OR logic and time-window aggregates
- **Alert Management** - Priority scoring, auto-assignment, SLA tracking, alert-to-case promotion
- **Case Management** - Investigation workflows, evidence collection, timeline, regulatory filing
- **Customer 360 View** - Unified profile with accounts, transactions, alerts, risk trending
- **Network/Link Analysis** - Relationship mapping, fund flow visualization
- **Reporting** - CTR/SAR regulatory reports, operational dashboards
- **Administration** - RBAC with 6 roles, audit trail, system configuration

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
# source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
python main.py
```
Backend starts at http://localhost:8000. Database is auto-created and seeded on first run.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend starts at http://localhost:5173.

## Demo Credentials

| Username | Role | Password |
|----------|------|----------|
| admin | System Administrator | Demo@2026 |
| sunita.krishnan | Compliance Officer | Demo@2026 |
| deepa.venkatesh | Risk Analyst | Demo@2026 |
| pradeep.mohan | Fraud Investigator | Demo@2026 |
| lakshmi.iyer | Internal Auditor | Demo@2026 |

## Demo Scenarios

1. **Structuring Detection**: Navigate to Customers > CIF-1001 (Rajesh Mehta) > 360 View. See multiple cash deposits just below INR 10,00,000 threshold.
2. **Layering Pattern**: Check CIF-1003 (Hassan Trading LLC). Rapid high-value RTGS/SWIFT transfers through connected entities.
3. **Card Fraud**: CIF-1010 (Ananya Sharma). Card used in multiple cities within hours.
4. **PEP Monitoring**: CIF-1015 (K. Dhanabalan). Former minister with enhanced monitoring.

## Tech Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy + SQLite
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Recharts
- **Auth**: JWT with RBAC (6 roles)

## Architecture

```
Frontend (React + TS + Tailwind + Recharts)
    |  REST API + WebSocket
API Gateway (FastAPI + JWT Auth + RBAC)
    |
Core Services: Transaction Monitor | AML Engine | Rules Engine
               Risk Scoring | Alert Service | Case Management
               KYC/CDD | Network Analysis | Reporting
    |
Data Layer: SQLite (demo) → PostgreSQL (production)
```

## Seed Data

- 49 customers with crafted personas (Indian banking context)
- 80+ accounts
- 4000+ transactions over 90 days
- 26 detection rules across AML, Fraud, KYC, Compliance
- 150 alerts in various statuses
- 25 investigation cases
- 200 watchlist entries
- KYC reviews and screening results for all customers
- Network relationships between high-risk entities
