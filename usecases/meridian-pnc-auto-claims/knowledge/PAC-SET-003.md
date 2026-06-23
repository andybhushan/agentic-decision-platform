---
docId: PAC-SET-003
title: Payment Channel and Recipient Routing
dimensions: [procedural, collaboration]
domain: insurance/auto/settlement
ontologyBindings: [acl:Payment, acl:Claimant, acl:ServiceProvider]
---

# Payment Channel and Recipient Routing

After the settlement amount is calculated ([[PAC-SET-001]]) and the disclosure composed ([[PAC-SET-002]]), the settlement-disbursement step picks the payment channel and the recipient(s). For repair-based settlements there is usually more than one payee.

## Recipients

A settlement may have **one or more** of the following recipients depending on the structure:

- **Policyholder** — direct payment to the named insured. Default for ACV total-loss settlements once the title is clear.
- **Lienholder** — for vehicles under loan or lease. Two-party check or escrow until lien is satisfied.
- **Lessor** — for leased vehicles. The lessor's interest is named on the title; the settlement may not exceed the lessor's payoff.
- **Repair shop (DRP/Tier-1 or Tier-2)** — direct-pay arrangement; carrier pays the shop, the policyholder pays only the deductible portion to the shop.
- **Medical provider** — out of v0 scope (medical claims handled separately).
- **Subrogation recipient** — out of v0 scope (recovery from at-fault third party handled separately).

The policyholder record from `dim_policyholder` includes the policy lien status and lessor information. The damage routing decision from Damage Handler (`tool.adjuster-roster` → shop tier) carries the shop identifier when repair-based.

## Channel selection

For each recipient, pick a channel:

| Channel | When | SLA |
|---|---|---|
| **ACH direct deposit** | Recipient is the policyholder AND policyholder has banking info on file AND amount > $0 | Funds available next business day |
| **Mailed check** | Policyholder has no banking info, OR recipient is non-bank (some lienholders) | 5-7 business days for delivery |
| **Two-party check** | Lienholder is named on the title and amount >= lienholder payoff | 5-7 business days |
| **Direct-pay (carrier-to-shop)** | Repair-based path AND shop is DRP or in-network | Net 30 from shop estimate approval |
| **Escrow** | Disputed lienholder amount OR settlement contains a holdback | Funds held until dispute resolves |
| **No-payment** | Full denial (settlementAmount == $0) | Disclosure letter only; no funds transfer |

For repair-based settlements the policyholder may receive an ACH or check for the deductible reimbursement portion **only if** they paid the shop directly and submitted proof; otherwise the deductible flows from policyholder → shop without the carrier touching it.

## Lien priority

When a lien is present and the settlement amount equals or exceeds the lienholder's stated payoff:

1. Lienholder receives the payoff via two-party check or wire.
2. Any residual (settlement minus payoff) flows to the policyholder.
3. The title transfer is initiated within 30 days of full payoff.

When settlement is **less than** the lienholder's payoff (under-insured loss):

1. The carrier pays the full settlement to the lienholder.
2. The policyholder remains responsible for the gap.
3. The disclosure (per [[PAC-SET-002]]) names this gap and the policyholder's obligation.

## Anti-fraud safeguards on payment routing

These checks happen at payment-routing time, after the calculation and disclosure are committed:

- The recipient bank account or address **must match** the policyholder of record or the named lienholder. No third-party redirection without a written assignment-of-benefits on file.
- A change in payment instructions within 14 days of the loss is a **soft fraud signal** — route to HITL for verification.
- ACH amounts >= $25,000 require a callback verification to the policyholder's phone of record before release. This is a payment-ops control, not an agent decision; the agent flags `highValueSettlement: true` to surface it.
- Direct-pay to a repair shop with >3 complaints in 90 days (per [[PAC-SHOP-001]] hard-exclusion threshold) is **never** released by this agent — operations must override.

## Outputs

The settlement-disbursement step emits:

- `recipients` — array of `{ kind: policyholder|lienholder|lessor|shop|escrow, identifier, amount, channel }`.
- `totalDisbursed` — sum of amounts across recipients. Must equal `settlementAmount` from PAC-SET-001 unless a holdback is in play.
- `disbursementDate` — earliest funds-available date across recipients.
- `verificationRequired` — list of pre-disbursement checks that must complete (callbacks, ACH micro-deposits, lienholder confirmations).
- `holdbacks` — escrowed amounts and the conditions for release (rare; typically dispute-driven).

## HITL gates at disbursement

The settlement-disbursement step should report low confidence (< 0.55) and route to HITL when:

- The recipient bank/address differs from the policyholder of record and no assignment-of-benefits is documented.
- The settlement-amount-to-lien-payoff ratio is within ±5% (boundary case for residual-to-policyholder).
- Any high-value settlement (`highValueSettlement == true`) is being routed — the package's `gate.high-value-settlement` opens automatically.
- The damage routing chose a Tier-2 shop with >2 complaints in 90 days (cross-checks against PAC-SHOP-001's soft threshold).
