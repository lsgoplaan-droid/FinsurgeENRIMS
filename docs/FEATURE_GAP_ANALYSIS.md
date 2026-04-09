# FinsurgeENRIMS — Feature Gap Analysis

**Date**: 09-Apr-2026
**Classification**: Confidential

---

## Executive Summary

15 functional feature gaps identified between the current prototype and a production-grade ERM system. These are features a bank would expect during UAT and go-live.

---

## Feature Gaps

| # | Feature | Priority | Current State | Production Requirement |
|---|---------|----------|---------------|----------------------|
| F1 | Real-time rules execution | P0 | Rules defined but not auto-triggered on transaction ingest | Rules engine evaluates every incoming transaction automatically, generates alerts in real-time |
| F2 | Transaction simulation/replay | P1 | No simulation capability | "What-if" mode: replay historical transactions against new/modified rules before enabling |
| F3 | Alert auto-assignment | P0 | Manual assignment only | Round-robin + workload-based + skill-based automatic routing to analysts |
| F4 | SLA escalation engine | P0 | SLA dates stored, not enforced | Background scheduler auto-escalates overdue alerts/cases, notifies managers |
| F5 | Email/SMS notifications | P0 | No notification delivery | Email + SMS on alert assignment, SLA warning, case escalation, system events |
| F6 | Report export (PDF/CSV) | P1 | No export functionality | PDF generation for CTR/SAR regulatory filing, CSV export for all data tables |
| F7 | Bulk customer import | P2 | Manual entry only | CSV/XML bulk import for customer onboarding with validation and error reporting |
| F8 | Dashboard drill-down | P2 | Static chart display | Click any chart segment to navigate to filtered detail view |
| F9 | Risk score recalculation | P1 | Static scores from seed data | Background job recalculating customer risk scores daily based on recent activity |
| F10 | Workflow approvals | P0 | Single-action close/escalate | Multi-level approval chains: analyst → compliance officer → compliance head |
| F11 | Scheduled reports | P1 | On-demand only | Auto-generate and email daily/weekly/monthly operational and regulatory reports |
| F12 | Mobile responsive | P2 | Desktop-optimized only | Responsive layout for tablet use by branch managers and field investigators |
| F13 | Multi-language support | P3 | English only | Hindi + regional language support for branch-level users |
| F14 | Multi-tenancy | P3 | Single bank instance | Support multiple branches/entities with data isolation and branch-level dashboards |
| F15 | Maker-checker workflow | P0 | No dual control | All sensitive actions (rule changes, case closure, report filing) need maker + checker approval |

---

## Priority Breakdown

| Priority | Count | Description |
|----------|-------|-------------|
| **P0 — Must have for go-live** | 5 | F1, F3, F4, F10, F15 |
| **P0 — Must have (ops)** | 1 | F5 |
| **P1 — Should have for UAT** | 4 | F2, F6, F9, F11 |
| **P2 — Nice to have** | 3 | F7, F8, F12 |
| **P3 — Future roadmap** | 2 | F13, F14 |

---

*This document supplements the Production Readiness Report.*
