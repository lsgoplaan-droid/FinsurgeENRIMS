# FinsurgeENRIMS -- RBI Compliance Mapping

**Prepared by**: Compliance Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Classification**: Confidential -- For Internal and Regulatory Use Only

---

## Purpose

This document maps every feature in FinsurgeENRIMS to the applicable Reserve Bank of India (RBI) regulation, the Prevention of Money Laundering Act (PMLA), the Digital Personal Data Protection Act (DPDP), and related circulars. It is intended for submission to the bank's Chief Compliance Officer, internal auditors, and RBI inspectors during on-site examinations.

---

## 1. RBI Master Direction -- Know Your Customer (KYC) Direction, 2016 (updated 2023)

Reference: RBI/DBR/2015-16/18, Master Direction DBR.AML.BC.No.81/14.01.001/2015-16

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| K1 | Customer onboarding with CIF creation | Section 3 -- Customer Acceptance Policy | Banks must establish customer identity before opening accounts; risk-based categorization at onboarding | Implemented |
| K2 | PAN / Aadhaar collection and storage | Section 16 -- Officially Valid Documents (OVD) | Collect PAN for transactions above INR 50,000; Aadhaar as OVD per Section 16(a) | Implemented |
| K3 | Customer risk categorization (low/medium/high/very_high) | Section 4 -- Risk Management | Risk-based approach: classify customers by risk at onboarding and review periodically | Implemented |
| K4 | PEP identification and flag | Section 33 -- Politically Exposed Persons | Identify PEPs; senior management approval for PEP relationships; enhanced monitoring | Implemented |
| K5 | KYC document verification workflow | Section 18 -- Customer Identification Procedure | Verify identity and address through OVDs before account activation | Implemented |
| K6 | Periodic KYC review (review_type: periodic/event_triggered) | Section 38 -- Updation of KYC | High risk: annual review; Medium: biennial; Low: once in 10 years | Implemented |
| K7 | Enhanced Due Diligence (EDD) for high-risk customers | Section 35 -- Enhanced Due Diligence | Additional verification for high-risk/PEP/non-face-to-face customers | Implemented |
| K8 | Beneficial ownership identification | Section 13 -- Beneficial Owner | Identify beneficial owners holding >10% (companies) or >15% (trusts) | Partial |
| K9 | Sanctions / watchlist screening (SequenceMatcher fuzzy match) | Section 33A -- Screening against UN/OFAC/RBI lists | Screen customers and counterparties against sanctions and PEP lists | Implemented |
| K10 | KYC document expiry tracking (kyc_expiry_date) | Section 38(3) -- KYC Renewal | Track and trigger reviews before KYC documents expire | Implemented |
| K11 | Non-face-to-face customer identification | Section 21 -- V-CIP / Video KYC | Video-based Customer Identification Process for digital onboarding | Planned |
| K12 | CKYC registry integration | Section 56A -- Central KYC Registry | Upload/download KYC records to CERSAI CKYC registry | Planned |

---

## 2. Prevention of Money Laundering Act (PMLA), 2002 and Rules (amended 2023)

Reference: Act No. 15 of 2003; PMLA Rules 2005 (amended 2023)

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| P1 | Transaction monitoring engine (26 rules) | PMLA Section 12(1)(a) -- Maintenance of Records | Monitor transactions, maintain records of prescribed transactions | Implemented |
| P2 | Cash Transaction Report (CTR) generation | PMLA Rule 3 -- CTR | Report all cash transactions above INR 10,00,000 (or equivalent) to FIU-IND within 15 days | Implemented |
| P3 | Suspicious Transaction Report (SAR/STR) generation | PMLA Section 12(1)(b) -- Suspicious Transaction Reporting | Report suspicious transactions to FIU-IND within 7 days of confirmation | Implemented |
| P4 | Structuring detection rules (amounts just below threshold) | PMLA Rule 3(1)(D) -- Integrally Connected Transactions | Detect splitting of transactions to evade reporting thresholds | Implemented |
| P5 | Alert-to-case-to-filing workflow | PMLA Section 12 -- Obligations of Reporting Entity | Full lifecycle: detection to principal officer review to FIU filing | Partial |
| P6 | Record retention (7+ years) | PMLA Section 12(1)(c) -- Record Keeping | Maintain transaction records for 5 years after closure; identity records for 5 years after cessation | Planned |
| P7 | Cross-border transaction monitoring (SWIFT channel) | PMLA Rule 3(1)(B) -- Cross-Border Wire Transfers | Monitor all cross-border transfers; collect originator/beneficiary info | Implemented |
| P8 | Principal Officer notification workflow | PMLA Section 12(1)(b) -- Principal Officer | Designated principal officer reviews and files STRs with FIU-IND | Partial |
| P9 | FIU-IND electronic filing (FINnet 2.0) | PMLA Rule 7 -- Electronic Filing | CTR/STR submissions via FIU-IND FINnet portal | Planned |
| P10 | Tipping-off prevention (no alert to customer) | PMLA Section 66(1)(ii) -- Tipping Off | System must not expose STR filing status to non-compliance roles | Implemented |
| P11 | Investigation case evidence and timeline | PMLA Section 50 -- Powers of Authority | Maintain investigation records and evidence chain for examination by Enforcement Directorate | Implemented |
| P12 | Counterfeit currency reporting | PMLA Rule 3(1)(C) -- Counterfeit Currency | Report counterfeit currency transactions to FIU-IND | Planned |

---

## 3. RBI Master Direction on Frauds -- Classification and Reporting (2024)

Reference: RBI/DoS/2024-25/166, Master Direction DoS.FrMC.01/14.01.070/2024-25

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| F1 | Fraud classification (card_fraud, identity_fraud, account_takeover, wire_fraud) | Section 4 -- Fraud Classification | Classify frauds per RBI taxonomy: advance fraud, forex fraud, card/internet fraud, deposit fraud, cyber fraud | Implemented |
| F2 | Fraud alert creation with priority scoring | Section 8 -- Early Warning Signals | Detect EWS indicators; generate alerts before loss crystallizes | Implemented |
| F3 | Case management with investigation workflow | Section 7 -- Examination of Fraud Cases | Staff accountability determination; investigation within time limits | Implemented |
| F4 | Fraud reporting by amount threshold | Section 5.1 -- Reporting to RBI | INR 1-5 crore: monthly; Above 5 crore: within 7 days FMR-1; Above 100 crore: same day flash report | Partial |
| F5 | Case disposition (true_positive/false_positive) | Section 6 -- Action on Detection | Close as fraud or non-fraud with documented rationale | Implemented |
| F6 | SLA tracking with auto-overdue detection | Section 5.2 -- Reporting Timelines | Critical: 4h, High: 24h, Medium: 72h, Low: 168h (configurable in system) | Implemented |
| F7 | Network/link analysis for connected fraud | Section 8(iii) -- Group/Connected Exposures | Track related parties and linked accounts in fraud schemes | Implemented |
| F8 | Quarterly fraud return (FMR-2) | Section 5.4 -- Quarterly Return | Automated generation of FMR-2 for aggregate fraud reporting | Planned |
| F9 | Flash report for large frauds (above INR 100 crore) | Section 5.1(c) -- Flash Report | Immediate notification to RBI DO, Board of Directors, audit committee | Planned |
| F10 | Red-flagged account (RFA) tracking | Section 8A -- Red Flagged Accounts | Flag accounts with EWS; restrict operations pending investigation | Partial |
| F11 | Staff accountability tracking | Section 7.2 -- Staff Accountability | Record staff involved; determine accountability within 6 months | Planned |

---

## 4. RBI Circular on Storage of Payment System Data (Data Localization), 2018

Reference: RBI/DPSS/2017-18/153, Circular DPSS.CO.OD.No.2785/06.08.005/2017-18

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| DL1 | Database designed for India-region deployment | Section 2 -- Data Storage | Entire payment system data must be stored in systems located only in India | Partial |
| DL2 | No cross-border data replication in application | Section 2(i) -- End-to-End Transaction Data | Transaction data, customer data, payment credentials must reside in India | Partial |
| DL3 | Deployment configuration supports India-only cloud regions | Section 2(ii) -- Audit Trail | Audit trail and log data must be stored within India | Planned |
| DL4 | Data localization compliance certificate | Section 3 -- System Audit Report | Board-approved SAR confirming India-only data residency | Planned |

---

## 5. Digital Personal Data Protection (DPDP) Act, 2023

Reference: Act No. 22 of 2023 (assented 11 August 2023)

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| DP1 | Purpose-limited data collection (risk management) | Section 4 -- Lawful Purpose | Process personal data only for lawful purpose with consent or legitimate use | Partial |
| DP2 | PII stored with Aadhaar hash (not plaintext) | Section 8(4) -- Data Minimization | Collect only data necessary for specified purpose; Aadhaar stored as hash | Implemented |
| DP3 | PAN masking in API responses (planned: XXXXX1234X) | Section 8(7) -- Data Security Safeguards | Implement reasonable security safeguards to protect personal data | Partial |
| DP4 | Role-based access control (6 roles, RBAC) | Section 8(4) -- Access Control | Restrict data access to authorized personnel based on role and need-to-know | Implemented |
| DP5 | Audit trail for data access | Section 8(5) -- Record of Processing | Maintain records of all processing activities for regulatory audit | Partial |
| DP6 | Customer consent management | Section 6 -- Consent | Obtain free, specific, informed, unconditional, and unambiguous consent | Planned |
| DP7 | Right to erasure / data deletion | Section 12 -- Right of Data Principal | Allow customers to request erasure (subject to legal retention obligations under PMLA) | Planned |
| DP8 | Data breach notification | Section 8(6) -- Breach Notification | Notify Data Protection Board and affected individuals upon breach | Planned |
| DP9 | Grievance redressal mechanism | Section 13 -- Grievance Redressal | Designate Data Protection Officer; respond within prescribed timelines | Planned |
| DP10 | Cross-border data transfer restrictions | Section 16 -- Transfer Outside India | Personal data transfer only to countries notified by Central Government | Planned |

---

## 6. Additional RBI Regulations

### 6.1 RBI Circular on Cyber Security Framework (2016)

Reference: RBI/2015-16/418, Circular DBS.CO/CSITE/BC.11/33.01.001/2015-16

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| CS1 | JWT-based authentication with token expiry | Section 5 -- Access Control | Strong authentication, session timeout, least privilege | Implemented |
| CS2 | Password policy (12 chars, complexity, 90-day rotation) | Section 5.2 -- Password Policy | Minimum length, complexity requirements, regular rotation | Implemented |
| CS3 | Rate limiting on login and API endpoints | Section 6 -- Network Security | Brute force protection, API abuse prevention | Implemented |
| CS4 | CORS whitelist configuration | Section 6.3 -- Application Security | Restrict cross-origin access to authorized domains | Implemented |
| CS5 | MFA / TOTP for privileged users | Section 5.1 -- Multi-Factor Authentication | MFA mandatory for admin and transaction approval functions | Planned |
| CS6 | TLS/HTTPS enforcement | Section 7 -- Encryption | Encrypt data in transit using TLS 1.2 or higher | Planned |
| CS7 | WAF and DDoS protection | Section 6.1 -- Perimeter Security | Web Application Firewall, intrusion detection/prevention | Planned |
| CS8 | Security incident reporting to CERT-In | Section 10 -- Incident Reporting | Report cyber incidents to RBI and CERT-In within 6 hours | Planned |

### 6.2 RBI Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices (2023)

Reference: RBI/DoS/2023-24/106

| # | System Feature | Regulation Section | Requirement | Status |
|---|----------------|-------------------|-------------|--------|
| IT1 | Application audit logging | Section 8 -- IT Audit | Comprehensive audit trail for all system activities | Partial |
| IT2 | Role-based access with 6 defined roles | Section 6 -- Access Management | Segregation of duties; role-based access; periodic access review | Implemented |
| IT3 | System configuration management | Section 7 -- Change Management | Documented change management; version control; approval workflow | Partial |
| IT4 | Business continuity / DR planning | Section 9 -- BCP/DR | RPO < 4 hours; RTO < 2 hours for critical systems | Planned |
| IT5 | Vulnerability assessment and pen testing | Section 10 -- Security Testing | Annual VA/PT by CERT-In empanelled auditor | Planned |

---

## Compliance Summary

| Category | Total Items | Implemented | Partial | Planned |
|----------|------------|-------------|---------|---------|
| KYC Direction 2016 (updated 2023) | 12 | 8 | 1 | 3 |
| PMLA 2002 / Rules | 12 | 7 | 2 | 3 |
| Fraud Master Direction 2024 | 11 | 6 | 2 | 3 |
| Data Localization 2018 | 4 | 0 | 2 | 2 |
| DPDP Act 2023 | 10 | 2 | 3 | 5 |
| Cyber Security Framework 2016 | 8 | 4 | 0 | 4 |
| IT Governance 2023 | 5 | 1 | 2 | 2 |
| **Total** | **62** | **28 (45%)** | **12 (19%)** | **22 (36%)** |

---

## Priority Actions for Full Compliance

### Immediate (before go-live)

1. **FIU-IND integration** (P2, P9) -- CTR/STR electronic filing via FINnet 2.0
2. **Data localization** (DL1-DL4) -- Deploy on Azure Central India; obtain board SAR
3. **TLS/HTTPS** (CS6) -- Mandatory for all API endpoints per encryption requirements
4. **MFA** (CS5) -- TOTP for admin, compliance officer, system administrator roles
5. **Audit trail completion** (IT1, DP5) -- Wire audit middleware to all API handlers

### Short-term (within 3 months)

6. **CKYC registry integration** (K12) -- Upload/download from CERSAI
7. **Consent management** (DP6) -- DPDP Act compliance before enforcement notification
8. **Fraud reporting automation** (F4, F8, F9) -- FMR-1/FMR-2/flash report generation
9. **PMLA principal officer workflow** (P8) -- Full Section 12 compliance
10. **Data retention policy** (P6) -- Auto-archive 7 years, purge 10 years

### Medium-term (within 6 months)

11. **Video KYC** (K11) -- V-CIP for digital onboarding
12. **Data breach notification** (DP8) -- Automated incident response workflow
13. **CERT-In empanelled audit** (IT5) -- Annual VA/PT certification
14. **BCP/DR** (IT4) -- Documented and tested business continuity plan

---

## Regulatory Examination Readiness

During an RBI on-site examination or IS audit, the following artifacts should be readily available:

| Artifact | Source | Location |
|----------|--------|----------|
| KYC compliance report | This document, Section 1 | docs/RBI_COMPLIANCE_MAPPING.md |
| CTR filing log | Reports module | /api/v1/reports/ctr |
| STR filing log | Reports module | /api/v1/reports/sar |
| Audit trail | Audit service | /api/v1/admin/audit-log |
| Customer risk distribution | Dashboard | /api/v1/dashboard/executive |
| Rule configuration and detection counts | Rules engine | /api/v1/rules |
| Investigation case files | Case management | /api/v1/cases/{case_id}/timeline |
| Watchlist screening results | KYC module | /api/v1/kyc/screening/{customer_id} |
| Data localization certificate | Infra team | Deployment documentation |
| CERT-In audit certificate | External auditor | Physical / scanned copy |

---

*This document must be reviewed quarterly by the Chief Compliance Officer and updated whenever RBI issues new circulars or directions affecting ERM systems.*
*Next scheduled review: 08-Jul-2026*
