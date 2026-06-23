---
docId: PAC-DAMAGE-002
title: Repair Cost Estimation Bands
dimensions: [procedural, historical]
domain: insurance/auto/damage
ontologyBindings: [acl:VehicleDamage, acl:Vehicle, acl:Exposure]
---

# Repair Cost Estimation Bands

The repair-estimate step produces a $-range estimate before a shop is engaged. It exists to size reserves, gate the total-loss threshold, and pre-classify the shop tier. It is **not** a final estimate — the assigned shop's estimate supersedes it once the vehicle is on a lift.

## Cost bands by category × vehicle class

Use the category from [[PAC-DAMAGE-001]] crossed with a vehicle class derived from `dim_vehicle`:

| Vehicle class | Cosmetic | Functional | Structural |
|---|---|---|---|
| Economy sedan (Honda Civic, Toyota Corolla, Hyundai Elantra, Chevy Malibu, Nissan Sentra) | $400–$1,400 | $1,500–$5,200 | $5,500–$16,000 |
| Mid-size sedan / hatchback (Honda Accord, Toyota Camry, Mazda 3, VW Jetta) | $500–$1,700 | $1,800–$6,000 | $6,500–$18,000 |
| Crossover / SUV (Toyota RAV4, Honda CR-V, Chevy Equinox, Ford Escape) | $550–$1,900 | $2,000–$6,800 | $7,500–$21,000 |
| Light truck / pickup (Ford F-150, Chevy Silverado, Ram 1500, Toyota Tundra) | $600–$2,200 | $2,400–$7,500 | $8,500–$24,000 |
| Premium / European (BMW, Audi, Mercedes, Volvo, Lexus) | $900–$3,000 | $3,500–$10,500 | $11,000–$30,000 |
| EV (Tesla, Rivian, Lucid, Polestar, Ford F-150 Lightning) | $1,200–$3,800 | $4,500–$13,000 | $14,000–$42,000 |

Bands assume **vehicle year ≥ year-3**. For vehicles older than 5 years, parts availability shifts the upper bound down by ~12% and shifts the lower bound up by ~5% (older parts harder to source).

For total-loss-suspect, do not produce a band — escalate per [[PAC-TOTAL-LOSS-001]].

## State modifiers

Labor rates vary by state. Apply a multiplier to the **upper bound** only:

- California, New York, Washington, Massachusetts: ×1.15.
- Florida, Texas, Illinois, Pennsylvania, Georgia: ×1.00 (baseline).
- Alabama, Mississippi, Arkansas, West Virginia, Kentucky: ×0.92.

The lower bound stays unchanged — parts pricing is national.

## Output shape

The repair-estimate step emits:

- `estimateLow` and `estimateHigh` — integer dollars.
- `estimateConfidence` — float in [0,1]. Penalize confidence when:
  - The vehicle class is unknown (year < 1990 or missing).
  - The damage description is sparse (< 30 chars) and no photo count is provided.
  - The Fabric IQ similar-claims population for this incident-type + state is < 3 prior claims.
- `bandRationale` — narrative that names the matched class, the category, and the state multiplier used.

## Threshold check

If `estimateHigh × 0.85 > 0.75 × estimatedACV`, mark the claim total-loss-suspect even if [[PAC-DAMAGE-001]] categorized it as structural. The 0.85 factor accounts for typical estimate-to-actual drift on structural repairs.
