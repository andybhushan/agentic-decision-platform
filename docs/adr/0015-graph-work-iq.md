# ADR-0015 — Microsoft Graph Work IQ (delegated scopes, local-only)

- **Status:** Accepted (v1, Track 3) — code complete, demo seed pending
- **Date:** 2026-05-28
- **Deciders:** Anand Bhushan
- **Supersedes:** the "deferred to v1" portion of ADR-0012

## Context

ADR-0012 documented the synthetic Work IQ source as a v0 stand-in and called out the v1 migration to Microsoft Graph. The banking stress test (FINDINGS.md) confirmed Work IQ was the last L5 source not anchored on a real service. Track 3 closes that loop with one important constraint: the deployer's tenant (`anand.bhushan@ibmalliance.onmicrosoft.com`) is IBM-managed; admin consent for app-only Chat/Mail/Files scopes will not be granted, and IBM-internal automation is broadly sensitive (see `feedback_ibm_security_no_automation` memory).

## Decision

Implement Microsoft Graph reads with **delegated scopes** only. The user signs in at run-time (Azure CLI cached or interactive browser); reads only the deployer's own data. Cloud Function MI uses app-only auth which would require admin consent, so the cloud Function keeps `WORKIQ_BACKEND=synthetic` as default — only local CLI runs activate the Graph path.

New source `MicrosoftGraphWorkIqSource` (raw HTTP, no `Microsoft.Graph` SDK dependency — keeps the assembly footprint small). DI in `TracesApi/Program.cs` selects between the synthetic source (`WorkIqSource`) and the Graph source based on `WORKIQ_BACKEND` env var.

## Implementation

`platform/src/ContextLayer/MicrosoftGraphWorkIqSource.cs`:

- `DefaultAzureCredential` against scope `https://graph.microsoft.com/.default`. Cached token across calls.
- Each Work IQ primitive maps to a Graph endpoint:

| Primitive | Graph endpoint | Required delegated scope |
|---|---|---|
| `triage-supervisor-thread`, `siu-consult-channel`, `shop-relationship-signal` | `/v1.0/me/messages?$search="{claim}"` | `Mail.Read` |
| `policyholder-contact-channel`, `payment-ops-signal` | `/v1.0/me/messages?$search="{claim}"` (same Outlook search) | `Mail.Read` |
| `damage-photo-thread`, `document-review-channel`, `shop-collab-history` | `/v1.0/me/drive/root/search(q='{claim}')` | `Files.Read.All` |
| `adjuster-availability`, `siu-investigator-availability` | `/v1.0/me/calendarView` next 7d | `Calendars.Read` |

- Errors degrade gracefully: a Graph failure returns a single `GRAPH_ERR/{primitive}` fragment with the error message; doesn't crash the run.
- Identifier safety + minimal HTTP shape; no recursive paging, top-N hardcoded.

DI selection in `TracesApi/Program.cs` (and CLI):

```csharp
IContextSource workIqSource = string.Equals(
        (Environment.GetEnvironmentVariable("WORKIQ_BACKEND") ?? "").Trim(),
        "graph", StringComparison.OrdinalIgnoreCase)
    ? new MicrosoftGraphWorkIqSource()
    : new WorkIqSource();
```

## Activation steps

1. **Register an Entra application** in `ibmalliance.onmicrosoft.com`:
   ```powershell
   az ad app create --display-name 'adp-v1-workiq-graph' --sign-in-audience AzureADMyOrg
   ```
2. **Grant delegated scopes**: `Mail.Read`, `Files.Read.All`, `Calendars.Read` (Chat.Read.All requires admin consent; intentionally omitted).
3. **Add redirect URI** `http://localhost` for interactive browser login.
4. **User self-consent** at first run — `az login` and use interactively; or run with `InteractiveBrowserCredential` which pops a browser.
5. **Seed your tenant** (one-time, manual — only you can do this in your mailbox/drive/calendar):
   - Create 1-2 Outlook emails with subject containing a `CLM-2026-DEMO-*` claim id.
   - Create 1 OneDrive folder/file named `CLM-2026-DEMO-*` with a few photos / a memo.
   - Schedule 1-2 calendar items in the next 7 days (any subject — used as the "adjuster availability" signal).
6. Set `WORKIQ_BACKEND=graph` env var and run the CLI / local Function.

Without seeding, the Graph source returns "no matching messages/files" — the source code path is exercised but data fragments are sparse. Synthetic source is more demo-friendly without seeding.

## Cloud activation: NOT recommended

The Function MI gets an app-only token. App-only Chat/Mail/Files require admin consent on the IBM tenant, which will be denied. Even if granted, app-only delegation would let the Function read OTHER users' mailboxes — a wider blast radius than this v1 wants. Cloud should stay synthetic.

If a Meridian-real or production tenant becomes available later (with admin consent for app-only scopes), the source code is ready — just change Function app settings to `WORKIQ_BACKEND=graph` and ensure the MI has the right Graph role assignments.

## Consequences

- L5 "Work IQ" claim is now genuinely architectural — code path exists for both synthetic and Graph.
- Cloud Function continues exactly as before (no change). Synthetic source is unchanged.
- Local CLI users can opt into Graph for a richer demo if they seed their mailbox/drive.
- IBM-tenant automation concerns are respected: only the deployer's own data is read; no admin-consented automation against the tenant.

## Trade-offs accepted

- **Graph source is not demo-effective without manual seeding.** The user has to put test data into their own Outlook/OneDrive for the Graph fragments to be meaningful. Acceptable — same trade-off as ADR-0012's synthetic-stand-in approach was already accepting.
- **No Teams chat search.** Mail.Read covers Outlook; ChannelMessage.Read.All / Chat.Read.All need admin consent. Outlook + Calendar + OneDrive surface enough of the "collaboration" concept for v1.
- **Raw HTTP instead of `Microsoft.Graph` SDK.** Smaller assembly footprint, no extra dependency tree, but we manage paging + types ourselves. For our shallow read pattern (top-3 results per endpoint), this is fine.

## Validation

- ✅ Build clean with the new source + DI switch.
- ✅ Graph endpoint shapes verified against current Microsoft Graph v1.0 docs.
- 🟡 Demo data seeding: pending the user creating test content in their own tenant.
- 🟡 Cloud deploy: will leave `WORKIQ_BACKEND` unset → synthetic continues to serve cloud agents. No regression.
