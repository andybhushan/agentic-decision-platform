---
docId: PAC-COV-001
title: Personal Auto Policy — Coverage Sections
dimensions: [procedural, regulatory]
domain: insurance/auto/coverage
ontologyBindings: [acl:Coverage, acl:Policy, acl:PolicyTerm]
---

# Personal Auto Policy — Coverage Sections

A standard US personal auto policy is structured into named coverage parts. Each part has its own limits, deductibles, and exclusions. A claim must map to at least one applicable coverage part for any payment to be made.

## Coverage parts

**Liability (Part A)** — Pays for bodily injury and property damage the insured causes to others. Applies only when the insured is at fault. Per-person, per-accident, and property damage sub-limits apply.

**Collision (Part D)** — Pays for damage to the insured vehicle from impact with another vehicle or object, regardless of fault. Subject to deductible. Required when the vehicle is leased or financed.

**Comprehensive (Part D, other-than-collision)** — Pays for damage to the insured vehicle from non-collision causes: theft, vandalism, fire, falling objects, hail, animal strikes, glass breakage, flood. Subject to deductible.

**Uninsured/Underinsured Motorist (Part C)** — Pays when the at-fault driver has no insurance or insufficient limits.

**Medical Payments (Part B)** — No-fault medical expenses for insured occupants. Subject to per-person sub-limit.

**Rental Reimbursement** — Pays rental car costs while the insured vehicle is in repair. Optional add-on.

**Rideshare Endorsement** — Extends coverage to periods when the insured is logged into a TNC app (Uber, Lyft) but has no rider. Optional add-on; required to maintain coverage during gig work.

## Coverage assignment

When a claim is filed, the coverage verification step must identify which coverage part(s) the loss falls under. A single incident can trigger multiple coverages (e.g., a hail event with glass damage triggers comprehensive; a rear-end collision can trigger collision for the insured vehicle damage plus liability for damage to the other vehicle if the insured is at fault).

If no applicable coverage part exists on the active policy, the claim is denied. If applicable coverage exists but a sub-limit is exceeded, the claim is partially covered up to the limit.
