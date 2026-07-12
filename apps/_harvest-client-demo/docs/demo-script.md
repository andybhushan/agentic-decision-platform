# PROJECT IMAGINE — Live Demo Script
### Focus: Decision Queue → Governed Action Preview

> **Demo environment:** `http://localhost:5173` (or the SWA prod URL). Log in with `demo123`.
>
> **Three hero claims** (verified in `backend/src/services/claimsDemoSeeder.ts`) deliberately chosen because each hits a *different* governance verdict on the Governed Action Preview screen:
>
> | Claimant | Claim ID | Scenario | Governance verdict on execute |
> |---|---|---|---|
> | **Carlos Ramirez** | CLM-2026-AUTO-102 | $11,350 hail, clean first-party peril | ✅ **Within delegated authority** → executes |
> | **Danielle Brooks** | CLM-2026-AUTO-103 | $18,400 injury + disputed liability | ⚠️ **Senior approval required** → captures sign-off |
> | **Trevor Lang** | CLM-2026-AUTO-107 | Suspected staged collision, SIU referral | ⛔ **Blocked by governance** → cannot execute |
>
> *(If seed IDs have drifted in your environment, pick by claimant name — the queue search box finds them.)*
>
> **Routes used:** `/claims/queue` · `/claims/{id}/decision` · `/claims/{id}/preview-action` · `/claims/intake` · `/agents` · `/agents?view=workforce` · `/governance`

---

## 1. Intro (≈60 seconds) — set the scene

> **Say:** "PROJECT IMAGINE is an agentic claims operation. A digital workforce takes a claim from first notice of loss all the way to settlement — but every consequential action stays under governed, human-accountable control. What I'm going to show you is the moment that matters most to a regulated insurer: **the decision point**. Not a black box approving payouts, but an AI that does the legwork, recommends an action, and then puts that action through a governance gate before a cent moves. I'll start at the adjuster's queue, work two claims, then show you how the claims got here and how the whole workforce is governed."

**[SCREEN]** Land on `/claims/queue`.

---

## 2. The Decision Queue (≈2 min) — the adjuster's command centre

**[SCREEN]** `/claims/queue` — the full claims table.

> **Say:** "This is the adjuster's queue. Every row is a claim the digital workforce has already triaged — you can see the **Stage**, a **Confidence Score**, **Complexity**, and what each claim is **Working On** right now. The adjuster isn't doing data entry; they're supervising."

**[DO]** Point out the columns: *Claim ID, Insured, Type, Working On, Stage, Current Status, Confidence Score, Complexity, Last Activity, Actions.*

**[DO]** Open the **Digital Steward** panel (right side).

> **Say:** "Before the adjuster picks anything, the **Digital Steward** — a supervisory agent — has already ranked the queue. It tells them the **single highest-priority claim**, *why* it outranks the others, the **total financial exposure** sitting in the queue, how many **fraud flags** are live, and the **oldest waiting** claim. This is cross-queue intelligence, not just a sorted list."

**[DO]** Point to the Steward's "Act now" and "Keep an eye on" lists, and the Queue Intelligence figures (total exposure, open decisions, high-priority count, fraud flags, oldest waiting).

> **Say:** "Let's take the Steward's advice and open the claim it's flagging."

---

## 3. Claim One — Carlos Ramirez (the clean path) (≈3 min)

**[SCREEN]** Click the **Carlos Ramirez / CLM-2026-AUTO-102** row → `/claims/{id}/decision` (**Decision Mode**).

> **Say:** "This is **Decision Mode** — everything the adjuster needs for *this one decision*, on one screen. Top line: a hail claim, **high confidence**, normal priority. The context strip carries claimant, policy, incident, location and SLA across every tab so they never lose the thread."

**[DO]** Walk the **Decision Needed** sub-tab:
- Point to the **decision box** header (`Settlement Approval`) and the green **WITHIN AUTHORITY** tag.
- Point to the **Coverage status** chip → **COVERED**, comprehensive peril, no third party.
- Scroll to **Recommended action** → the AI's proposed settlement with the **settlement breakdown table** (Labor, Parts, Parts Sales Tax, Towing, Less: Deductible) and the **three repair quotes** (Caliber Collision, Maaco, Quick Tow).

> **Say:** "The agent has done the appraisal work — itemised the settlement, benchmarked three repair vendors, and confirmed coverage. On the right, **Things to consider** surfaces anything the adjuster should weigh. Everything's clickable to drill into the underlying evidence."

**[DO]** Briefly click the **Decision Related Evidence** sub-tab → click an evidence item → the **Evidence Intelligence modal** opens (AI Review / Analysis / Evidence Status / Source Lineage / Metadata tabs).

> **Say:** "Each piece of evidence has an AI review, a verification status, and full **source lineage** — critical for audit. Damage photos, FNOL statement, and a NOAA weather report all verified."

**[DO]** Close the modal. Draw attention to the **sticky action bar** at the bottom.

> **Say:** "Notice the actions are pinned here — **Redirect/reassign**, **Request more evidence**, or **Approve action**. The adjuster is never more than one click from a decision. Let's approve."

**[DO]** Click **Approve action** → navigates to `/claims/{id}/preview-action` (**Governed Action Preview**).

### 3a. Governed Action Preview — the clean execution

> **Say:** "This is the **Governed Action Preview** — the governance gate. Nothing executes until it passes through here."

**[DO]** Point to the **green banner: "Within delegated authority — this action has passed all governance controls."**

**[DO]** Walk the four tiles:
- **Action Summary** — action type, description, confidence, rationale.
- **Agent Execution Details** — which agent, its capabilities, its governance profile.
- **Data Operations** — exactly what the action will **read** (claim record, policy doc, evidence, claimant profile) and **write** (status update, decision log, **audit trail entry**, claimant notification), plus external systems (payment + email).
- **Audit & Compliance** — the green compliance checks (regulatory, policy terms, evidence sufficiency) and the **estimated risk** tag.

**[DO]** Scroll to the **Claimant-Facing Message Preview**.

> **Say:** "It even pre-drafts the claimant communication, **reviewed for regulatory tone and wording** — so the customer-facing message is governed too."

**[DO]** Click **Confirm and Execute** → confirmation modal → **Confirm**. The **Live Agent Activity** panel animates the execution, then routes back to the queue with an "Action Executed" success toast.

> **Say:** "The agent executes the steps live, writes the audit record, and returns to the queue. Clean claim, delegated authority, done in seconds — fully logged."

---

## 4. Claim Two — Danielle Brooks (governance escalation) (≈3 min)

> **Say:** "But not every claim is clean. This is where governance earns its keep."

**[SCREEN]** Back on `/claims/queue`, open **Danielle Brooks / CLM-2026-AUTO-103**.

**[DO]** In **Decision Mode**, highlight:
- **MEDIUM confidence**, **HIGH priority**, decision type **Anomaly Review**.
- The **Risk & anomaly signals** panel → **Liability Conflict** (both drivers claim right-of-way) and an **injury** flag (soft-tissue / whiplash).
- Coverage **COVERED**, but the decision box shows **APPROVAL REQUIRED** with **Routes to: Senior adjuster queue**.

> **Say:** "$18,400, a disputed-liability intersection collision with a reported injury. The agent has done the analysis, but it's flagged a **liability conflict** and an **injury exposure** — and crucially, this exceeds the adjuster's delegated authority."

**[DO]** Click **Review & approve** (the button changes label when approval is required) → **Governed Action Preview**.

### 4a. Governed Action Preview — senior sign-off enforced

**[DO]** Point to the **amber banner: "Senior approval required — this action falls outside delegated authority."**

**[DO]** Click **Confirm and Execute** → the modal now **requires the approving senior adjuster's name** before the Confirm button enables.

> **Say:** "The system won't let it through on the adjuster's authority alone. To execute, they must **name the approving senior adjuster** — that sign-off is captured and bound to the audit record. Same screen, same flow, but the **control adapts to the risk**. When it executes, the toast reads *'executed with senior sign-off.'*"

**[DO]** Enter a name (e.g. *Michael Chen*) → **Confirm** → executes with sign-off.

---

## 5. The governance hard-stop — Trevor Lang (≈90 sec) — *the money shot*

> **Say:** "And here's the line the AI cannot cross."

**[SCREEN]** Open **Trevor Lang / CLM-2026-AUTO-107** → Decision Mode.

**[DO]** Highlight: **LOW confidence**, **URGENT**, **Fraud Investigation**, anomaly signals (damage geometry inconsistent, witness phone linked to a prior claim, late notification), **escalated to SIU**, settlement **blocked**.

**[DO]** Go to the **Governed Action Preview**.

> **Say:** "Suspected staged collision, referred to the Special Investigations Unit. Watch the gate."

**[DO]** Point to the **red banner: "Blocked by governance"** and the **disabled "Confirm and Execute" button.**

> **Say:** "There is **no path to auto-execute** a payout on an open fraud investigation — the execute button is hard-disabled at both the UI and the backend. The only routes are **redirect for review** or hold. This is the guarantee a regulator wants: the agent is powerful, but it is **structurally incapable** of doing the wrong thing on a flagged claim."

---

## 6. Tail — How the claims got here: FNOL (≈2 min, medium detail)

**[SCREEN]** `/claims/intake` (**FNOL Conversational Intake**).

> **Say:** "Quick rewind — how did these claims enter the system? Through **First Notice of Loss**. This is a **conversational, voice-capable intake agent** — the *Mobile Intake Assistant* — not a form to fill in."

**[DO]** Show the chat surface and gate cards (consent, evidence, callback, summary).

> **Say:** "The claimant just talks. The agent already knows their **policy and coverage** before they start, and it works through structured phases: incident details, then **injury and liability** questions, **evidence capture** with consent, and a summary. It's listening for escalation signals the whole time — **injury, fraud indicators, police involvement, customer distress** — and flags them."

> **Say:** "When the claimant submits, the agent **creates the claim, attaches the evidence, and routes it to the right adjuster automatically** — injury claims to Sarah Pemberton, suspected fraud to the SIU specialist Priya Patel, high-value to a senior. That routing is *why* Danielle's injury claim and Trevor's fraud claim landed where they did. So everything you saw in the queue was assembled, evidenced, and triaged by the workforce **before** a human ever looked at it."

---

## 7. Tail — Agent Workforce (≈2–3 min)

**[SCREEN]** `/agents` then toggle **Workforce** view (`/agents?view=workforce`).

> **Say:** "That workforce is configurable, not hard-coded. The **Claims Processing Workforce** is a coordinated team of **six Digital Workers** taking a claim from FNOL to closure."

**[DO]** Point out the staged flow: **Intake channels** (Web, Mobile, Call Centre, Branch) → **Claim Digital Worker (orchestrator, N7)** → **Doc Review → Fraud → Policy → Settlement**, with **Compliance** running across all of it.

**[DO]** Use the claim picker → **Run claim** to simulate one claim flowing through the stages (status dots per stage).

> **Say:** "I can run a real claim through the pipeline and watch each stage complete with a pass / attention indicator."

**[DO]** Click the orchestrator (**N7**) → member detail.

> **Say:** "Drill into any worker and you get its **coordination tree** — the sub-agents it manages — plus its **governance profile**: authority level, escalation path, confidence thresholds, memory scope. Some steps are agents, some are deliberately **human-in-the-loop**, like low-confidence document review. The org chart of the digital workforce is fully transparent."

---

## 8. Tail — Governance Dashboard (≈2–3 min)

**[SCREEN]** `/governance` (**Governance Dashboard**).

> **Say:** "Finally, the operational control plane. Everything those agents did is measured here."

**[DO]** Point to the metric tiles: **policy violation rate, governance override rate, escalation rate, runtime error rate, tool failure rate, avg duration, tokens, and cost per interaction** — with red / amber thresholds.

**[DO]** Show **Agent Operations** (live: active agents, interactions, escalations, response time, est. cost) and **Agent Health & Risk** (highest-risk agent, error / tool-failure rates).

**[DO]** Open the **Audit Trail** tab.

> **Say:** "Every governed action — including the two we just executed and the one we **blocked** — lands in this **audit trail**: event type, severity, the agent, the claim ID, the actor, and a timestamp. Policy violations, overrides, escalations, runtime errors, tool failures — all here."

**[DO]** Point to the **Entra / A365 / GitHub** signal indicators.

> **Say:** "And it's wired to enterprise identity — **Microsoft Entra and A365** — so agent governance sits inside your existing security posture. The Digital Steward you met at the queue is itself a governed agent on this dashboard. That's the whole promise: an autonomous claims workforce that is fast where it's allowed to be, and **provably constrained** where it has to be."

---

## Closing line

> **Say:** "Agentic speed on the clean claims, enforced human accountability on the hard ones, and a hard stop on the ones that shouldn't move at all — every step audited. That's governed AI claims handling."

---

## Appendix — Presenter quick reference

**Claim cheat-sheet**

| Claimant | Claim ID | Amount | Confidence | Priority | Decision type | Adjuster | Governance verdict |
|---|---|---|---|---|---|---|---|
| Carlos Ramirez | CLM-2026-AUTO-102 | $11,350 | High | Normal | Settlement Approval | David Ashworth | Within authority — executes |
| Danielle Brooks | CLM-2026-AUTO-103 | $18,400 | Medium | High | Anomaly Review | Sarah Pemberton | Approval required — senior sign-off |
| Trevor Lang | CLM-2026-AUTO-107 | $0 (reserve held) | Low | Urgent | Fraud Investigation | Priya Patel | Blocked — cannot execute |

**Governance verdict logic (Governed Action Preview)**
- **Blocked (red):** coverage `excluded`, OR `Fraud Investigation` with one or more high-severity anomaly signals → Confirm & Execute disabled (enforced in UI and backend).
- **Approval required (amber):** action exceeds delegated authority → must capture approving senior adjuster name before execute.
- **Within authority (green):** all governance controls passed → executes immediately, fully logged.

**Reset between runs:** the demo executes real decisions (status changes). To re-run from a clean slate, use the Governance Dashboard controls **"Clear claims data"** then **"Re-import & run all claims agents"**, or re-seed before the session.

**Source references**
- Seed claims: `backend/src/services/claimsDemoSeeder.ts`
- Decision Queue: `frontend/src/pages/DecisionQueuePage.tsx`
- Decision Mode: `frontend/src/pages/DecisionModePage.tsx`
- Governed Action Preview: `frontend/src/pages/ActionPreviewPage.tsx`
- FNOL intake: `frontend/src/pages/FNOLConversationPage.tsx`, `backend/src/routes/fnolSessionRoutes.ts`
- Related work: GitHub issue #2 (Decision Mode: sticky action bar, settlement breakdown & evidence modal)
