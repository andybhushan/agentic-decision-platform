---
docId: PAC-SHOP-001
title: Repair Shop Network — Selection Policy
dimensions: [procedural, collaboration]
domain: insurance/auto/damage
ontologyBindings: [acl:VehicleDamage, acl:ServiceProvider, acl:Vehicle]
---

# Repair Shop Network — Selection Policy

The shop-routing step picks one repair shop per claim after damage assessment completes. The shop must match the damage category, the vehicle's make, and the policyholder's state. Network shops accept the carrier's direct-pay terms and report progress through the Decision Journal.

## Shop tiers

**Tier-1 (DRP — Direct Repair Program)** — Carrier-vetted, OEM-certified shops with guaranteed lifetime workmanship warranty. Accept cosmetic, functional, and structural categories. Required for any structural repair on a luxury/EV vehicle. Higher labor rate, faster cycle time, and policyholder receives a rental during repair.

**Tier-2 (Network)** — Non-DRP shops in the carrier's network. Accept cosmetic and functional categories. Workmanship warranty is the shop's (not the carrier's). Lower labor rate. Acceptable for non-structural repairs on mainstream vehicles.

**Tier-3 (Out-of-network)** — Policyholder's choice of shop. Carrier pays the estimate amount only; any overage is the policyholder's. Acceptable for cosmetic only. Tier-3 routes do not receive Decision Journal status updates from the shop.

## Selection priority order

1. **Category fit.** Structural ⇒ Tier-1 only. Functional ⇒ Tier-1 or Tier-2. Cosmetic ⇒ any tier.
2. **OEM certification for premium vehicles.** If make ∈ {BMW, Audi, Mercedes-Benz, Lexus, Volvo, Porsche, Tesla, Rivian, Lucid}, restrict to Tier-1 shops carrying that make's OEM certification.
3. **Geography.** Same-state preferred (insurance-billing simpler). Cross-state acceptable only if no in-state shop matches categories 1–2.
4. **Capacity.** Among shops matching 1–3, prefer the one with the lowest `currentLoad` (active claims being repaired) and shortest declared lead-time.
5. **Cycle-time history.** Among shops still tied, prefer the one with the lower 30-day p90 cycle time (Fabric IQ historical query).

## Hard exclusions

A shop is **never** picked when:

- The shop has an active complaint count > 3 in the last 90 days (operations flag).
- The vehicle make is on the shop's "won't service" list (some Tier-2 shops opt out of EVs).
- The shop's certifications are expired (annual recert; expired ⇒ Tier-1 status revoked until renewal).

## Outputs

The shop-routing step emits:

- `shopId` — chosen shop identifier.
- `shopTier` — tier-1 | tier-2 | tier-3.
- `shopName`, `shopCity`, `shopState` — for the operator console.
- `routingReason` — narrative naming the matched tier, make-certification (if applied), and load comparison.
- `estimatedStartDate` — derived from shop lead-time + earliest available appointment.

## HITL gates

The shop-routing step should report low confidence (< 0.55) and route to HITL when:

- No in-state shop carries the required OEM certification (policyholder must consent to cross-state routing).
- The lowest-load shop is at >75% capacity (cycle time will exceed SLA; senior adjuster should choose).
- A Tier-3 path is the only match (the policyholder must explicitly accept the out-of-network economics).
