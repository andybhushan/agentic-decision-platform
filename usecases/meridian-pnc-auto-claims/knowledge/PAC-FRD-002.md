---
docId: PAC-FRD-002
title: Fraud Pattern Detection - Claim Clustering, Rings, and Sequence Signals
dimensions: [procedural, historical]
domain: insurance/auto/fraud
ontologyBindings: [acl:FraudIndicator, acl:Claim, acl:Vehicle, acl:LossEvent]
regulatoryBasis: ["NAIC AI Model Bulletin §4.1 (pattern-detection oversight)", "NAIC Model Insurance Fraud Prevention Model Act §6"]
---

# Fraud Pattern Detection — Claim Clustering, Rings, and Sequence Signals

The Fraud Handler DW runs **after** the FNOL Handler has flagged a claim for fraud review (or in parallel when initial triage assigned fraudIndicatorCount >= 1). Where [[PAC-FRD-001]] covers per-claim red flags, this document covers cross-claim pattern detection — the signals that only surface when you can join across the policyholder's history, the vehicle's history, and the prior similar-claim population.

## Three pattern families

**Frequency clustering** — Same policyholder, multiple claims in a tight window.
- 3+ claims under one policy in 24 months (already in PAC-FRD-001 as a per-claim flag).
- 2+ claims under one VIN where the prior claims have less than 90 days between repair-complete and the new incident date.
- Cluster of claims (≥4) in the same ZIP code with the same incident type and same week — possible staged-incident ring signal.

**Ring patterns** — Same vehicle, witnesses, or repair shops appearing across claims that should be unrelated.
- Same VIN appears as a third-party vehicle in 2+ prior claims (vehicle is "rented" for ring use).
- Same passenger name on 2+ injury claims under different policies.
- Same repair shop receives 5+ claims with total-loss-suspect categorizations in 30 days (shop-fraud pattern; cross-checks against [[PAC-SHOP-001]]).
- Cluster of claims sharing the same SIU-flagged adjuster handoff history (intentional adjuster steering).

**Sequence signals** — The order and timing of claim events that don't fit a normal loss pattern.
- Policy reinstated after lapse and a loss reported within 7 days.
- Coverage limit increase within 30 days of loss (already in PAC-FRD-001).
- Reporting delay > 14 days followed by an unusually detailed narrative (possible "story preparation" time).
- Adjuster reassignment requested within 48h of initial assignment without a documented reason.

## How the Fraud Handler reasons over patterns

The Fraud Pattern Scan agent (`agent.fraud-pattern-scan`) queries the Fabric IQ semantic layer using two intents:

- `analyze_fraud_patterns` returns prior similar claims (same incident type, same state) with their severity hints and dates. The agent looks for any of the three pattern families above.
- `verify_fraud_signal` returns the policyholder claim history and the VIN history together — used to spot frequency clustering and ring patterns.

The agent also queries Foundry IQ for the regulatory boundaries (states differ on what constitutes investigable insurance fraud) — see [[PAC-FRD-003]].

## Pattern outputs

For each pattern family the agent finds evidence for, emit:

- `patternFamily` — `frequency-clustering` | `ring-pattern` | `sequence-signal`.
- `patternEvidence` — narrative naming the specific claims, VINs, addresses involved.
- `populationSize` — count of records the pattern was derived from (low N reduces confidence).
- `populationConfidence` — float in [0,1]. Drops when the prior-claims population is < 5 records.

## What pattern detection cannot do alone

Pattern detection is a **screening** function. It produces signals for the Fraud Score agent ([[PAC-FRD-003]]) and the SIU referral path ([[PAC-SIU-001]]). It is not a fraud finding by itself. A claim is **never** denied based on pattern detection alone. The pathway is always: pattern → score → SIU review → SIU finding → claims decision. The agent's job is to surface, not to decide.

## What is NOT a pattern signal

The fraud-pattern-scan agent must not weight any of the following as a pattern signal:

- The policyholder's ethnicity, national origin, religion, or any protected class.
- The vehicle's value relative to neighborhood median (this is a routing input for SIU, not a fraud indicator).
- The age of the policyholder.
- Whether the policyholder has filed claims with other insurers (cross-carrier history is **not** authoritative; only ChAID-style internal patterns count).
