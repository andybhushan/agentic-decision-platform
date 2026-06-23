# Research notes — standard P&C auto claims + agentic value (for the UC4 PRD)

**Date:** 2026-06-19 · **Owner:** Anand Bhushan
**Status:** Deep-research run hit the API session limit (all claims abstained, not refuted). **Key figures re-verified directly 2026-06-19 — see the Verification box below.** Remaining (non-headline) figures are still indicative; re-run the full verification before any external deck.

> ## ✅ Verification (2026-06-19, direct check)
> - **Leakage 7–14% (EY): CONFIRMED.** Broader industry estimates range wider (~5–10%, some sources lower); 7–14% is EY's figure. Subrogation: ~15% of claims close with a missed recovery opportunity (~$15–20B/yr industry).
> - **McKinsey value: CORRECTED.** Actual McKinsey ("Claims in the digital age"): CSAT **+10–15 points** (NOT "+20%"), claims-handling expense **reduced up to ~30%**, payment accuracy **+~4 points**. The "20% CSAT" figure (from a third-party blog) was wrong — do not use it.
> - **NAIC AI Model Bulletin: CONFIRMED.** Adopted Dec 2023; documented AIS Program; governance across actuarial/data-science/underwriting/claims/legal/compliance; validation/testing + bias evaluation + documentation for regulators; **24 states adopted**.
> - **"LAE ≈ 80% of premium": REJECTED (implausible).** LAE is a fraction of premium, not 80%. Excluded.
> - Sources: ey.com (leakage), mckinsey.com "Claims in the digital age" (value), NAIC model bulletin / Kennedys / Holland & Knight (regulatory).

## Economics & pain (indicative)
- **Claims leakage ≈ 7–14%** of total claims spend (EY); ~10% of a ~$1.5T global P&C claims pool (Five Sigma).
- **Loss ratio** = (claims paid + LAE) / earned premium (opsdog). **LAE** is a major cost line (Loveland cites it as a large share of premium — figure looks high, verify).
- Litigation/defense: P&C insurers spend **>$23B/yr** on defense & cost containment; avg third-party **BI indemnity ≈ $27k**, up ~38% since 2020 (EY).
- Adjuster-level leakage is real: lower-performers overpay materially per claim; **~half of subrogation requests rejected for incomplete documentation** with no tracking (TheLab case study).

## Value of reinvention (indicative)
- McKinsey ("Claims in the digital age"): digitization can **+CSAT 10–15 points** and reduce **claims-handling expense up to ~30%** (+~4 pts payment accuracy). *(Corrected 2026-06-19; the earlier "+20% CSAT" via a blog was wrong.)*
- TheLab case study (standardization + RPA/AI + adjuster "Super KPIs"): **−25% opex, −15% cycle time**, NIGO/rework **−70%**, FNOL follow-up calls **−67%**, ~**7x 12-month ROI**, 6-month break-even; savings split **~60% leakage/subrogation, 40% efficiency**.
- Five Sigma (vendor): **−40% leakage, −30% cycle time**, up to 90% STP in simple lines (pet).

## Agentic stage mapping (ValueMomentum)
Six end-to-end stages: **FNOL/intake** (NLP extraction + policy verify + real-time triage) → **coverage** → **CV damage assessment** → **fraud risk scoring** → **settlement** (negotiation/payment) → **closure** (compliance docs + claimant updates). **HITL gates** required for edge cases, policy inconsistencies, high-risk fraud, disputed settlements; adjusters reallocated to complex/high-value claims (PwC simple/moderate/complex segmentation).

## Regulatory / compliance bar (NAIC via Lumenova; PwC)
- **NAIC AI Model Bulletin**: written **AIS Program** governance across the full lifecycle incl. claims admin + fraud; controls **commensurate with consumer harm** (claims denials = stricter); **independent model validation**, **drift monitoring**, **bias analysis**, and **data lineage/provenance** for auditability.
- Regulators scrutinize **adverse consumer outcomes, fair claims settlement practices, modeling in claims decisions** → consent-based data, anonymization, governance controls essential.

## Sources (quality tag from the run)
| Source | Quality |
|---|---|
| pwc.com — auto-insurance-claims-reinvention | primary |
| ey.com — insurance/claims-litigation | secondary |
| lumenova.ai — NAIC AI model bulletin guide | secondary |
| opsdog.com — loss ratio | secondary |
| thelabconsulting.com — claims leakage case study | secondary |
| lovelandinnovations.com — reducing LAE & cycle times (cites McKinsey) | blog |
| fivesigmalabs.com — claims intelligence | blog |
| valuemomentum.com — agentic systems for claims | blog |
| ltimindtree.com — agentic AI insurance claims | flagged unreliable |

> **Action:** when the session limit resets, re-run the deep-research workflow (cached angles will skip) to get a verified figure set before any external use.
