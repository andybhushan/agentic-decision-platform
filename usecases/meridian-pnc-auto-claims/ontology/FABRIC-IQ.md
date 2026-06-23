# Fabric IQ Semantic Layer (ADP / Meridian auto-claims)

**LIVE** on Fabric workspace **`adp-v1`** (lakehouse `adp`, capacity `offeringsfabric001`, DT sub).

## Deployed items (final)
Two complementary realizations are live (both built from `data/fabric-gold-generator/`):
1. **Fabric IQ Ontology** `claims_ontology` (item type **Ontology**) + auto-generated **GraphModel** `claims_ontology_graph_*` — the real Fabric IQ graph-ontology: 23 EntityTypes + RelationshipTypes + DataBindings to the `adp` lakehouse; **RefreshGraph Completed** (graph materialized). Built by `build-fabric-iq-ontology.mjs`. This is what `fabric_iq_agentic_retrieval` / a Data Agent grounds on.
2. **Semantic model** `claims_semantic` (Direct Lake .bim) — Power BI model with the gate-rule DAX measures + glossary + PII OLS (below). Built by `build_ontology.mjs`.
> Note: the 23 gold tables are valid Managed Delta (confirmed via the tables API); if the Lakehouse Explorer shows them under "Unidentified", just **refresh** the lakehouse — it's a metadata-sync display lag, not a data problem.

## What's deployed
**`claims_ontology`** — a Direct Lake **semantic model** (the 23-entity domain ontology/graph), built by `data/fabric-gold-generator/build_ontology.mjs`:

- **23 entities** (Direct Lake tables): the 18 core claims entities (claim, policy, policy_term, coverage, vehicle, exposure, loss_event, vehicle_damage, damage_part, total_loss_evaluation, fraud_indicator, payment, adjuster, claimant, party_person, loss_location, loss_event_vehicle, loss_event_party) **+ 5 multimodal** (evidence, consent, transcript, visual_evidence, document).
- **31 relationships** (18 active) — the domain graph, incl. evidence→claim, consent→evidence, transcript→loss_event, visual_evidence→evidence/vehicle_damage, document→claim.
- **Gate rules as DAX measures** (Fabric-native rule encoding): `G3 Total Loss Gate` (R-TL-001: total_loss_probability ≥ 0.70 → TRIP, licensed-adjuster), `Total Loss Rate %`, `Fraud Signal` / `Clean Claim Rate %` (R-TRG-001 G1).
- **Business glossary** — entity + key-column descriptions (incl. PII flags).
- **PII object-level security** — role `PII-Restricted` masks `party_person.date_of_birth` + `driver_license_number` (R-PTY-001).

## How to (re)build
```
cd usecases/meridian-pnc-auto-claims/data/fabric-gold-generator
node generate.mjs --out ./data --count 100         # 23 gold CSVs
WORKSPACE_ID=<ws> LAKEHOUSE_ID=<lh> SUBSCRIPTION=<sub> node load.mjs   # load to lakehouse
FAB_TOKEN=… STG_TOKEN=… node build_ontology.mjs    # build the semantic ontology
```
(IDs default to the live adp-v1 workspace/lakehouse; tokens via `az account get-access-token`.)

## NL Data Agent (final portal step — ~5 min)
A **Fabric Data Agent** (NL → query over this semantic layer) is created in the Fabric portal (Data Agent creation is portal/preview, not in the stable REST items API):
1. In workspace `adp-v1` → **New → Data Agent** (name e.g. `claims_data_agent`).
2. Add data sources: the **`adp` lakehouse** + the **`claims_ontology` semantic model**.
3. Add agent instructions (claims-analyst persona; cite entities; respect the gate-rule measures + PII role).
4. Publish → it answers NL questions ("how many total-loss claims this week?", "show evidence + consent for claim X") grounded on the governed ontology.

This is the same pattern the ADP runtime already consumes via `SEMANTIC_BACKEND=fabric` (FabricLakehouseSource over the lakehouse); the Data Agent adds the conversational NL surface for analysts.
