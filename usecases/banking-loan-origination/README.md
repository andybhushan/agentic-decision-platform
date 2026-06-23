# banking-loan-origination — Stress test for the platform boundary

**Status:** stress-test only. Not a product.

This use case exists to **empirically test ADR-0001's platform-vs-usecase boundary claim**. The hypothesis: the ADP platform should be able to run a non-P&C package without any change to `platform/src/`. The leakage we identified earlier (Meridian-shaped intent dispatches in semantic sources, P&C-shaped MCP tools in `V0ToolRegistry`, P&C-shaped Lakehouse schema) predicts specific functionality degradations — this folder lets us measure them.

## Predicted outcomes

| Component | Prediction | Observation |
|---|---|---|
| Schema validation | ✓ passes (schema is industry-agnostic) | (filled after run) |
| Compile pipeline | ✓ passes | (filled after run) |
| Foundry IQ (AI Search) | ✓ works if docs indexed; text-keyword retrieval is generic | (filled after run) |
| Fabric IQ semantic source | ✗ returns empty for unknown banking intents | (filled after run) |
| Work IQ source | ✗ returns empty for unknown banking intents | (filled after run) |
| MCP tools | N/A — package declares no tools | (filled after run) |
| LLM step execution | ✓ works (StepRunner is generic) | (filled after run) |

## Scope

2 agents, 2 knowledge docs, 3 sample loan applications. Just enough to exercise the platform path end-to-end.

Findings written up in `FINDINGS.md` after the stress test run.
