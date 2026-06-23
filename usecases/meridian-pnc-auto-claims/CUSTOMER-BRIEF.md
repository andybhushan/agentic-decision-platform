# Customer Brief — Meridian Mutual (UC4: Agentic Claims Processing)

**Fictitious carrier, reskinnable to any P&C insurer.** Lead with this brief in every demo. Figures are verified (see `spec/RESEARCH-NOTES.md`).

## 1. Customer profile
**Meridian Mutual** — a mid-size US personal-auto carrier (~$2.4B DWP, ~1.1M policies in force, 14 states). Direct + independent-agent distribution. Modernizing claims after a hard market and rising loss-adjustment costs.

## 2. Stakeholders (who's in the room)
| Role | Name | Cares about |
|---|---|---|
| Chief Claims Officer (economic buyer) | Patricia Vance | leakage, cycle time, LAE, CSAT |
| VP Claims Ops (champion) | Marcus Reyes | adjuster productivity, STP rate, queue load |
| Lead Adjuster (adoption gatekeeper) | Derek Chen | "does it make my day easier or just watch me?" |
| Compliance / Legal (veto) | Renee Okafor (ex-DOI) | NAIC AI bulletin, fair-claims regs, auditability, HITL on denials |

## 3. AS-IS (today's systems + tech stack)
- **Claims admin:** Guidewire ClaimCenter (system of record). **Policy:** Duck Creek. **Estimatics:** CCC + Mitchell. **Payments:** internal + ACH. **Fraud/SIU:** rules + manual referral. Telematics from a dashcam partner; FNOL via phone + a basic mobile app.
- **Reality:** FNOL data is re-keyed; triage + coverage checks are manual; adjusters swivel-chair across 4-5 systems; total-loss + subrogation decisions are slow and inconsistent.

## 4. Pain points (quantified, verified)
- **Claims leakage ≈ 7–14% of claims spend** (EY) — the single biggest prize; inconsistent coverage/severity decisions and missed subrogation (~15% of claims close with a missed recovery, ~$15–20B/yr industry).
- **Cycle time** drags (rental, litigation exposure accrue daily); **LAE** rising; **adjuster capacity** consumed by low-complexity claims that could be straight-through.
- **CSAT** suffers from slow, opaque decisions.

## 5. Why it isn't solved already
- Point AI tools (photo estimation, fraud scores) are **bolted on**, not governed or auditable end-to-end.
- Carriers can't put ungoverned AI on **coverage decisions** — the **NAIC AI Model Bulletin** (24 states) requires a documented AIS Program, validation, bias controls, and a human in the loop on consequential decisions. No audit trail = no go-live.

## 6. Solution (what we show)
An **agentic claims platform** on Microsoft-native Azure: digital-worker agents run the FNOL→triage→coverage→routing lifecycle, **grounded** on a governed data + semantic foundation (Fabric Lakehouse + AI Search), every step **explainable** (GROUNDED vs DERIVED + citations), with **architectural HITL gates** that fire on genuine model uncertainty — not scripted. Carrier-agnostic; Meridian today, Chubb/Progressive tomorrow by reskin.

## 7. Outcome (the value story)
- **Leakage down** via consistent, grounded coverage/severity decisions + surfaced subrogation.
- **Cycle time down + STP up** on simple claims; adjusters reallocated to complex, high-value work (McKinsey: claims-handling expense **down up to ~30%**, **CSAT +10–15 points** from digitization).
- **Compliance-ready:** immutable decision journal + explainability + HITL satisfy the NAIC bar — the thing that lets it actually ship.

## 8. Hero moment
A claim runs live: 4 agents process it in seconds, each **GROUNDED** with citations to policy/claims knowledge — then on an ambiguous coverage call the **HITL gate fires automatically** (confidence below threshold), routing to Derek with the full rationale. *The AI knew what it didn't know.* That is what wins Renee (compliance) and Derek (adjuster) in the same breath.

---

## Scenario-realism validation (per the UC3 discipline)
| Check | Verdict |
|---|---|
| **Industry fit** | ✅ Standard P&C personal-auto lifecycle; standard systems (Guidewire/Duck Creek/CCC). |
| **Data fit** | ✅ Synthetic 1k-claim corpus loaded to Fabric (dim_policyholder/dim_vehicle/fact_claims) + 19 knowledge docs indexed; deterministic. |
| **Honest ADRs (no overpromise)** | ✅ Foundry/Fabric/HITL choices in `spec/adr/`; HITL gate is real (fires on confidence), not scripted; estimatics/payments/subrogation are **simulated** in MVP (stated). |
| **Realistic AS-IS** | ✅ Swivel-chair, re-keyed FNOL, manual triage/coverage — the real adjuster pain. |
| **Quantified pain** | ✅ Leakage 7–14% (EY), McKinsey cost/CSAT, NAIC bar — all verified. |
| **1:1 pain → resolution** | ✅ leakage→grounded decisions+subro; cycle→STP; compliance→journal+HITL. |
| **Overreach to flag** | Estimatics/payment/subrogation are simulated; full-lifecycle (settlement/recovery) is roadmap, not MVP. Say so. |
