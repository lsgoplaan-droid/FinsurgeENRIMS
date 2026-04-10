# Investigation Copilot — Complete Walkthrough

**What it does:** AI-powered analysis that reduces alert investigation time from 4-6 hours to **30-45 minutes**.

**Where:** Dashboard → Main Menu → **Investigation Copilot** (or http://localhost:5173/investigation-copilot)

---

## 🧠 What is the Investigation Copilot?

An intelligent assistant that automatically:
1. **Pulls customer 360** — Full customer profile, risk score, KYC status
2. **Analyzes transaction patterns** — Volume, channels, velocity, unusual activity
3. **Identifies risk factors** — PEP status, high risk score, expired KYC, multiple flags
4. **Generates recommendations** — Specific next steps for each alert
5. **Calculates investigation score** — Quick risk assessment (0-100)
6. **Offers one-click actions** — Escalate, create case, close alert, add notes

**Result:** Instead of manually digging through 5+ screens, you get **actionable intelligence in one place**.

---

## 🎯 How to Use It (Step-by-Step)

### Step 1: Open Investigation Copilot
- Click **Dashboard** → Left sidebar → **Investigation Copilot** (Brain icon)
- Or navigate directly to http://localhost:5173/investigation-copilot

### Step 2: View Alert Queue (Left Panel)
You'll see:
- **Search bar** — Find alerts by alert number or title
- **Alert list** — All "new" (unassigned) alerts
- Currently shows: **~150 sample alerts**

Each alert card shows:
- Alert number (e.g., `ALT-20260409-0142`)
- Priority badge (Critical/High/Medium/Low)
- Title (e.g., "Possible Structuring - Hassan Trading")
- Time created (e.g., "2 days ago")

### Step 3: Click an Alert to Investigate
Click any alert → Copilot auto-analyzes and loads:
1. **Alert Summary** — Risk score + priority
2. **Customer Profile** — Name, CIF, risk score, PEP status, location
3. **Risk Factors** — Specific reasons this alert matters
4. **AI Analysis** — Narrative explaining the pattern
5. **Recommended Actions** — Numbered steps to take
6. **Related Alerts** — Other alerts on this customer
7. **Action Buttons** — One-click operations

---

## 📊 What You'll See in the Analysis

### Investigation Score (Top Right)
**Scale:** 0-100  
**Colors:**
- 🔴 **70+:** Critical (red) — Needs immediate escalation
- 🟠 **40-69:** High (amber) — Senior analyst review required
- 🟢 **<40:** Medium/Low (green) — Can be handled by junior analyst

**Example:**
```
Score: 82 (CRITICAL)
"Very high risk score + Multiple flagged txns + PEP status"
```

### Customer Profile (Grid)
Shows at a glance:
| Field | Example |
|-------|---------|
| Name | Rajesh Kumar |
| CIF | CIF-1005 |
| Risk Score | 62 |
| Category | High |
| PEP | Yes |
| City | Mumbai |
| State | Maharashtra |
| Occupation | Import/Export Trader |

**Links:**
- Click "View Customer 360" → See full customer network, transactions, all alerts

### Risk Factors (Red Box) 🚨
Lists specific things triggering the alert:
- ✓ "Very high risk score (82/100)"
- ✓ "Politically Exposed Person (PEP)"
- ✓ "5 other alerts on this customer"
- ✓ "Multiple flagged transactions"

### AI Analysis (Purple Box) 🤖
Example narrative:
```
"Customer has conducted 47 transactions in 90 days totaling INR 2.1 crores. 
12 transactions were flagged as suspicious based on velocity and amount patterns 
consistent with potential structuring (breaking down large amounts into smaller 
transactions below reporting thresholds). 

Customer's occupation listed as 'Import/Export Trader' which is high-risk 
for trade-based money laundering. Risk score of 82 indicates elevated suspicion.

Recommended: Immediate escalation to compliance team. Consider filing STR 
with FIU-IND if pattern confirmed."
```

### Recommended Actions (Green Box) ✅
Numbered list of concrete steps:
```
1. Escalate to senior analyst immediately
2. Apply Enhanced Due Diligence (EDD) procedures
3. Consider opening a case — pattern of suspicious activity
4. Review full transaction history for structuring patterns
5. Document findings in alert notes before disposition
```

### Related Alerts (Bottom)
Shows other alerts on same customer:
- Helps you see the pattern (e.g., "Oh, this person has 3 structuring alerts!")
- Clickable links to each related alert

---

## 🔘 Action Buttons (One-Click Operations)

### Button 1: Create Case
- **Use when:** Alert is confirmed suspicious, needs formal investigation
- **Action:** Converts alert → creates a new Case, redirects to Case detail page
- **Example:** "ALT-20260409-0142 (Structuring)" → "CSE-20260409-0001"

### Button 2: Escalate
- **Use when:** Alert needs senior analyst review but not case-worthy yet
- **Action:** Marks alert as escalated, reassigns to senior analyst
- **Status:** Alert moves from "new" → "escalated"

### Button 3: Add Note
- **Use when:** You want to document your thinking before closing
- **Action:** Popup asks "Add an investigation note" → Stores in alert timeline
- **Example:** "Reviewed customer's bank statements. Pattern consistent with structuring per RBI typology #4."

### Button 4: Confirm Fraud ✓
- **Use when:** You've verified the alert is a TRUE POSITIVE
- **Action:** Closes alert with disposition "true_positive"
- **Triggers:** May auto-create SAR/STR report, audit trail entry
- **Asks:** "Justification for closing as true positive:" (required)

### Button 5: Mark False Alarm ✗
- **Use when:** Investigation shows normal business activity
- **Action:** Closes alert with disposition "false_positive"
- **Asks:** "Justification for closing as false positive:" (required)
- **Example:** "Customer is registered jeweler. High volume is normal for business."

---

## 💡 Common Investigation Scenarios

### Scenario 1: Alert is TRUE POSITIVE (Confirmed Fraud)
```
1. Review alert + customer profile
2. Check "Risk Factors" — if 3+ factors, likely real
3. Read "AI Analysis" — confirms pattern
4. Click "Confirm Fraud"
5. Enter justification: "Customer has 15 transactions under 10L each in 1 week. 
   Matches structuring typology. Escalating to STR filing."
6. Alert closes, SAR/STR auto-filed, audit trail logged ✅
```

### Scenario 2: Alert is FALSE POSITIVE (Normal Activity)
```
1. Review alert + customer profile
2. Notice customer is "Registered Jeweler" (occupation)
3. Realize high transaction volume is normal for business
4. Check "AI Analysis" for pattern
5. Click "Mark False Alarm"
6. Enter justification: "Customer is verified jeweler. High transaction volume 
   is typical for business operations. No suspicion indicators found."
7. Alert closes, marked false positive, audit trail logged ✅
```

### Scenario 3: Alert Needs Formal Investigation
```
1. Review alert + customer profile
2. See "5 other alerts on this customer"
3. AI Analysis: "Pattern suggests potential money laundering"
4. Risk Factors: 3+ critical indicators
5. Click "Create Case"
6. Case CSE-XXXXXX is created, redirected to Case detail page
7. Now formally investigate with full case workflow ✅
8. Later: Close case with formal disposition
```

### Scenario 4: Alert is Borderline, Needs More Review
```
1. Review alert + customer profile
2. Not enough evidence yet to confirm
3. Add a note: "Requested bank statements from customer. Pending review."
4. Click "Add Note"
5. Alert stays "new" (unresolved)
6. Next analyst picks it up, continues investigation
7. Your note helps context ✅
```

---

## 📈 The Full Investigation Flow

```
┌─────────────────────────────────────────┐
│  Alert Triggered by Rules Engine        │
│  (e.g., structuring, high velocity)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Investigation Copilot                   │
│  • Pulls customer 360                   │
│  • Analyzes transaction patterns        │
│  • Calculates investigation score       │
│  • Generates recommendations            │
│  • Shows related alerts                 │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        ▼             ▼          ▼          ▼
    ┌────────┐  ┌──────────┐ ┌────────┐ ┌────┐
    │ TRUE   │  │ FALSE    │ │ CREATE │ │ADD │
    │ FRAUD  │  │ ALARM    │ │ CASE   │ │NOTE│
    └────┬───┘  └────┬─────┘ └───┬────┘ └─┬──┘
         │           │           │        │
         ▼           ▼           ▼        ▼
    SAR/STR     Closed          Case   Noted
    Filed       (FP)           Created In
               (Done)         Investigation
                                (Pending)
```

---

## 🎓 Real Example: Investigating "Possible Structuring"

### The Alert
```
Alert #: ALT-20260409-0142
Title: Possible Structuring - Hassan Trading LLC
Priority: HIGH
Risk Score: 78
Status: NEW
Rule: Structuring Typology - Multiple transactions <1L breaking pattern
```

### Opening in Copilot
1. Click the alert in the list
2. Copilot loads...
3. Investigation score: **76 (Critical)**

### Analysis Section Shows:
```
🚨 Risk Factors:
- High risk score (78/100)
- 8 flagged transactions in 30 days
- Customer type: Corporate (trading company)
- Multiple transactions just under 1L (reporting threshold)

🤖 AI Analysis:
"Hassan Trading shows a clear structuring pattern. The merchant has conducted 
42 transactions in the last 30 days. Of these, 8 transactions are between 
999,900 - 1,000,000 INR (just below the 1L reporting threshold), followed by 
0-2 day gaps. This pattern is consistent with 'structuring' or 'smurfing' 
typology #4 per FATF guidance and RBI's suspicious transaction indicators.

The customer's declared business (trading) has sufficient legitimate volume to 
mask suspicious activity. Counterparties show no clear business relationship."

📋 Recommendations:
1. Escalate to compliance officer immediately
2. Request trade invoices for last 30 transactions
3. Verify counterparty business legitimacy
4. Consider filing STR with FIU-IND
5. Document all findings in case file
```

### Your Decision
**Option A: Confirm Fraud**
- Click "Confirm Fraud"
- Reason: "Clear structuring pattern below 1L threshold. Suspicious counterparties. No legitimate business purpose evident."
- ✅ Result: Alert closed, STR auto-filed, audit trail logged

**Option B: Create Case**
- Click "Create Case"
- ✅ Result: New investigation case created, full case workflow begun
- Assign to investigator, collect documents, formal disposition later

**Option C: Add Note & Escalate**
- Click "Add Note": "Requested trade invoices and counterparty KYC from customer"
- Click "Escalate"
- ✅ Result: Note added, alert escalated to senior analyst, awaiting follow-up

---

## ⚡ Quick Keys to Remember

| What You See | What It Means | What To Do |
|---|---|---|
| Score 70+ | Critical risk | Click "Escalate" or "Confirm Fraud" |
| Score 40-69 | High risk | Senior analyst review, likely "Create Case" |
| Score <40 | Medium/Low risk | Can mark false alarm or add note |
| "5+ other alerts" | Repeated offender | Click "Create Case" for formal investigation |
| PEP status: Yes | Enhanced oversight | Apply EDD, likely file STR |
| Multiple flagged txns | Pattern confirmed | Click "Confirm Fraud" or "Create Case" |
| Risk factors: 0 | Low risk | Mark "False Alarm" with justification |

---

## 📱 Tips & Tricks

1. **Search feature** — Use to quickly find alerts (e.g., "ALT-20260409" or "Hassan")
2. **Related Alerts** — Always review if there's a pattern (3+ related = likely real)
3. **Customer 360** — Click the link to see transactions, network, accounts
4. **Audit Trail** — Every action (escalate, close, note) is logged automatically
5. **Justification required** — Always enter reason when closing alert (why fraud? why false?)
6. **Note early** — Add investigation notes as you go, not at the end

---

## 🎯 Typical Investigation Times

| Activity | Manual (Old) | With Copilot |
|---|---|---|
| Read alert details | 10 min | 30 sec (auto-pulled) |
| Pull customer 360 | 15 min | 10 sec (auto-pulled) |
| Analyze pattern | 30 min | 2 min (AI analysis) |
| Decide disposition | 15 min | 1 min (recommendations) |
| Document & close | 20 min | 30 sec (one-click) |
| **TOTAL** | **~90 min** | **~3-4 min** |

**Real-world:** For complex alerts, you still spend time verifying (calling customer, reviewing docs), but Copilot **eliminates busy work**.

---

## 🔍 What Happens After You Act

### If you close as TRUE POSITIVE
1. ✅ Alert marked "closed_true_positive"
2. ✅ SAR/STR report auto-filed (in production)
3. ✅ Customer risk score increased
4. ✅ Audit trail entry created (timestamp, user, reason)
5. ✅ Case may auto-open for formal follow-up

### If you close as FALSE POSITIVE
1. ✅ Alert marked "closed_false_positive"
2. ✅ Reason stored in alert notes
3. ✅ Rules engine learns (may reduce similar false positives)
4. ✅ Audit trail entry created
5. ✅ Alert removed from queue

### If you escalate
1. ✅ Alert reassigned to senior analyst
2. ✅ Status changes to "escalated"
3. ✅ Still visible in Investigation Copilot for senior analyst
4. ✅ Escalation reason logged

### If you create case
1. ✅ New investigation case created
2. ✅ Alert linked to case
3. ✅ Redirect to full Case detail page
4. ✅ Can now assign investigators, attach evidence, formal workflow

---

## ❓ FAQ

**Q: Can I undo a close action?**
A: Yes — go to alert detail page, click "Reopen alert"

**Q: How many alerts can I investigate at once?**
A: One at a time in Copilot (by design — focuses attention). You can open multiple in separate tabs.

**Q: Are the recommendations always right?**
A: No — they're AI-generated suggestions. Use your judgment + bank policy.

**Q: Can I see audit trail of what I did?**
A: Yes — go to Customer360Page, click "Audit Trail" tab → See all actions logged

**Q: What if the customer info is wrong?**
A: Go to Customers page, update customer profile separately. Copilot pulls latest data.

**Q: How do I file STR manually?**
A: Go to Reports → SAR/STR Filing (or it auto-files when you "Confirm Fraud")

---

## 🚀 You're Ready!

1. Go to Dashboard → **Investigation Copilot**
2. Click any alert with HIGH/CRITICAL priority
3. Read the risk factors and recommendations
4. Take one action: Escalate, Create Case, Mark False Alarm, or Confirm Fraud
5. Watch audit trail log your investigation

**The goal:** From 4-6 hours of manual work → 30-45 minutes of smart investigation.

Happy investigating! 🔍

