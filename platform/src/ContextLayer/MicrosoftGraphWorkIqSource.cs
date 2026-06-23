using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;

namespace Adp.ContextLayer;

// v1 (Track 3, ADR-0015): real Microsoft Graph reader for Work IQ. Uses delegated scopes against
// the deployer's own tenant (anand.bhushan@ibmalliance.onmicrosoft.com per session 2026-05-28). For
// each Work IQ primitive, issues an HTTP GET against the matching Graph endpoint.
//
// Auth: DefaultAzureCredential against scope `https://graph.microsoft.com/.default`. In local CLI
// this falls back to InteractiveBrowserCredential / AzureCliCredential — user signs in once and
// reads their own data. In cloud (Function MI), DefaultAzureCredential gets an app-only token, but
// Chat.Read.All / Files.Read.All etc. require admin consent which IBM tenant won't grant — so the
// cloud Function should keep WORKIQ_BACKEND=synthetic. This source is genuinely usable only locally.
//
// Activation: WORKIQ_BACKEND=graph + (optional) GRAPH_DEMO_ADJUSTER_UPN for the adjuster-availability
// primitive. Without a seeded tenant the responses will mostly be empty — the synthetic source
// (SyntheticWorkIqSource) remains the demo-friendly path.
public sealed class MicrosoftGraphWorkIqSource(TokenCredential? credential = null, HttpClient? httpClient = null) : IContextSource, IDisposable
{
    public string SourceId => "WorkIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Collaboration,
        ContextDimension.Temporal,
    ];

    private readonly TokenCredential _credential = credential ?? new DefaultAzureCredential();
    private readonly HttpClient _http = httpClient ?? new HttpClient { BaseAddress = new Uri("https://graph.microsoft.com/") };
    private static readonly TokenRequestContext _graphScope = new(["https://graph.microsoft.com/.default"]);
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _cachedToken;
    private DateTimeOffset _cachedTokenExpiresAt = DateTimeOffset.MinValue;

    public static MicrosoftGraphWorkIqSource FromEnvironment() => new();

    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        if (request.SourceBindings is null) return [];
        if (!request.SourceBindings.TryGetValue(SourceId, out var primitives) || primitives is null || primitives.Count == 0)
            return [];

        var combined = new List<ContextFragment>();
        foreach (var primitive in primitives)
        {
            if (string.IsNullOrEmpty(primitive)) continue;
            try
            {
                var frags = primitive switch
                {
                    WorkIqSource.PrimitiveTriageThread                => await SearchClaimMessagesAsync(request.SubjectId, "triage-support", cancellationToken),
                    WorkIqSource.PrimitiveSiuConsultChannel           => await SearchClaimMessagesAsync(request.SubjectId, "siu-consult", cancellationToken),
                    WorkIqSource.PrimitivePolicyholderContactChannel  => await SearchEmailsAsync(request.SubjectId, "policyholder-contact", cancellationToken),
                    WorkIqSource.PrimitivePaymentOpsSignal            => await SearchEmailsAsync(request.SubjectId, "payment-ops", cancellationToken),
                    WorkIqSource.PrimitiveDamagePhotoThread           => await SearchOneDriveFilesAsync(request.SubjectId, "damage-photos", cancellationToken),
                    WorkIqSource.PrimitiveDocumentReviewChannel       => await SearchOneDriveFilesAsync(request.SubjectId, "disclosure-review", cancellationToken),
                    WorkIqSource.PrimitiveAdjusterAvailability        => await GetMyCalendarAsync(request.SubjectId, "adjuster", cancellationToken),
                    WorkIqSource.PrimitiveSiuInvestigatorAvailability => await GetMyCalendarAsync(request.SubjectId, "siu", cancellationToken),
                    WorkIqSource.PrimitiveShopCollabHistory           => await SearchOneDriveFilesAsync(request.SubjectId, "shop-history", cancellationToken),
                    WorkIqSource.PrimitiveShopRelationshipSignal      => await SearchClaimMessagesAsync(request.SubjectId, "shop-routing", cancellationToken),
                    _ => [],
                };
                combined.AddRange(frags);
            }
            catch (Exception ex)
            {
                // Graph failures should not break the run; degrade to empty fragments + a tiny diagnostic.
                combined.Add(new ContextFragment(
                    SourceId: SourceId,
                    DocId: $"GRAPH_ERR/{primitive}",
                    Title: $"Graph query failed for {primitive}",
                    Content: $"Real Graph call failed: {ex.GetType().Name}: {ex.Message}. Suggest WORKIQ_BACKEND=synthetic for this run.",
                    RelevanceScore: 0.0,
                    Origin: "DERIVED",
                    Dimensions: SupportedDimensions));
            }
        }
        return combined;
    }

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_cachedToken is not null && DateTimeOffset.UtcNow < _cachedTokenExpiresAt.AddMinutes(-2))
                return _cachedToken;
            var token = await _credential.GetTokenAsync(_graphScope, ct);
            _cachedToken = token.Token;
            _cachedTokenExpiresAt = token.ExpiresOn;
            return _cachedToken;
        }
        finally { _tokenLock.Release(); }
    }

    private async Task<JsonElement> GraphGetAsync(string url, CancellationToken ct)
    {
        var token = await GetTokenAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        using var resp = await _http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new HttpRequestException($"{(int)resp.StatusCode} {resp.ReasonPhrase}: {body[..Math.Min(300, body.Length)]}");
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.Clone();
    }

    private async Task<IReadOnlyList<ContextFragment>> SearchClaimMessagesAsync(string claim, string context, CancellationToken ct)
    {
        // Use Outlook messages search for the claim id keyword. Teams chat search would be /me/chats/getAllMessages
        // but that endpoint requires Chat.Read which has admin-consent prereqs; Outlook message search uses Mail.Read
        // (also Mail-scope) — works with delegated user-consent.
        var url = $"v1.0/me/messages?$search=\"{Uri.EscapeDataString(claim)}\"&$top=3&$select=subject,bodyPreview,from,receivedDateTime";
        var root = await GraphGetAsync(url, ct);
        var messages = root.GetProperty("value");
        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Outlook messages mentioning '{claim}' (context={context}):");
        int n = 0;
        foreach (var m in messages.EnumerateArray())
        {
            n++;
            var subject = m.TryGetProperty("subject", out var s) ? s.GetString() : "(no subject)";
            var preview = m.TryGetProperty("bodyPreview", out var b) ? b.GetString() : "";
            var from = m.TryGetProperty("from", out var f) && f.TryGetProperty("emailAddress", out var ea) && ea.TryGetProperty("name", out var fn) ? fn.GetString() : "";
            var when = m.TryGetProperty("receivedDateTime", out var d) ? d.GetString() : "";
            sb.AppendLine(inv, $"- {when?[..Math.Min(10, when.Length)]}: {subject} (from {from})");
            sb.AppendLine(inv, $"    {Truncate(preview, 120)}");
        }
        if (n == 0) sb.AppendLine("(no matching messages in your mailbox; seed with a test thread mentioning the claim id to demo)");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"GRAPH_MSG/{claim}/{context}",
            Title: $"Outlook signal for {claim}",
            Content: sb.ToString(),
            RelevanceScore: n > 0 ? 0.9 : 0.4,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<IReadOnlyList<ContextFragment>> SearchEmailsAsync(string claim, string context, CancellationToken ct)
        => await SearchClaimMessagesAsync(claim, context, ct);

    private async Task<IReadOnlyList<ContextFragment>> SearchOneDriveFilesAsync(string claim, string context, CancellationToken ct)
    {
        // Search the user's OneDrive for files whose name or path contains the claim id.
        var url = $"v1.0/me/drive/root/search(q='{Uri.EscapeDataString(claim)}')?$top=3&$select=name,webUrl,lastModifiedDateTime,size";
        var root = await GraphGetAsync(url, ct);
        var items = root.GetProperty("value");
        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"OneDrive files mentioning '{claim}' (context={context}):");
        int n = 0;
        foreach (var item in items.EnumerateArray())
        {
            n++;
            var name = item.TryGetProperty("name", out var nm) ? nm.GetString() : "(unnamed)";
            var when = item.TryGetProperty("lastModifiedDateTime", out var d) ? d.GetString() : "";
            sb.AppendLine(inv, $"- {when?[..Math.Min(10, when.Length)]}: {name}");
        }
        if (n == 0) sb.AppendLine("(no matching files; seed your OneDrive with a placeholder doc mentioning the claim id to demo)");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"GRAPH_FILE/{claim}/{context}",
            Title: $"OneDrive signal for {claim}",
            Content: sb.ToString(),
            RelevanceScore: n > 0 ? 0.85 : 0.4,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<IReadOnlyList<ContextFragment>> GetMyCalendarAsync(string claim, string role, CancellationToken ct)
    {
        var startTime = DateTime.UtcNow.ToString("o");
        var endTime = DateTime.UtcNow.AddDays(7).ToString("o");
        var url = $"v1.0/me/calendarView?startDateTime={Uri.EscapeDataString(startTime)}&endDateTime={Uri.EscapeDataString(endTime)}&$top=5&$select=subject,start,isAllDay,showAs";
        var root = await GraphGetAsync(url, ct);
        var items = root.GetProperty("value");
        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Calendar availability window (next 7 days) acting as {role} proxy:");
        int busy = 0, total = 0;
        foreach (var item in items.EnumerateArray())
        {
            total++;
            var subject = item.TryGetProperty("subject", out var s) ? s.GetString() : "";
            var when = item.TryGetProperty("start", out var st) && st.TryGetProperty("dateTime", out var dt) ? dt.GetString() : "";
            var showAs = item.TryGetProperty("showAs", out var sa) ? sa.GetString() : "";
            if (string.Equals(showAs, "busy", StringComparison.OrdinalIgnoreCase)) busy++;
            sb.AppendLine(inv, $"- {when?[..Math.Min(16, when.Length)]}: {Truncate(subject, 60)} ({showAs})");
        }
        if (total == 0) sb.AppendLine("(no calendar items in window)");
        else sb.AppendLine(inv, $"Summary: {busy}/{total} marked busy.");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"GRAPH_CALENDAR/{claim}/{role}",
            Title: $"Calendar signal for {role} proxy ({claim})",
            Content: sb.ToString(),
            RelevanceScore: total > 0 ? 0.85 : 0.4,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private static string Truncate(string? s, int max) => string.IsNullOrEmpty(s) ? "" : s.Length <= max ? s : s[..max] + "...";

    public void Dispose() { _tokenLock.Dispose(); _http.Dispose(); }
}
