using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Adp.ContextLayer;

// v0 Work IQ implementation: deterministic synthetic collaboration fragments.
// Per ADR-0012: same `IContextSource` contract a v1 Microsoft Graph implementation will satisfy.
// Real Graph requires app registration + delegated/admin-consented permissions on a Meridian-like tenant,
// which is out of scope for v0. This source generates plausible collaboration fragments per claim by
// hashing the claim number for a stable seed and selecting from canned templates that vary by intent.
//
// What this is NOT: a real Microsoft Graph reader. There is no Teams, Outlook, or SharePoint call.
// What this IS: a believable, deterministic stand-in that completes the L5 trio and proves the
// federation in `ContextRouter` — agents reason over Fabric IQ + Foundry IQ + Work IQ simultaneously.
public sealed class WorkIqSource : IContextSource
{
    public string SourceId => "WorkIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Collaboration,
        ContextDimension.Temporal,
    ];

    // Named fragment-shape primitives this source exposes. Packages select via sourceBindings.
    // Per-shape canned templates are P&C-coloured by content (supervisor names, adjuster ids, shop
    // names) but the names themselves are dispatch keys — a new use case can reuse a generic shape
    // ("supervisor-consult-thread") or contribute new shapes by extending this class.
    public const string PrimitiveTriageThread              = "triage-supervisor-thread";
    public const string PrimitiveAdjusterAvailability      = "adjuster-availability";
    public const string PrimitiveDamagePhotoThread         = "damage-photo-thread";
    public const string PrimitiveShopCollabHistory         = "shop-collab-history";
    public const string PrimitiveShopRelationshipSignal    = "shop-relationship-signal";
    public const string PrimitiveSiuConsultChannel         = "siu-consult-channel";
    public const string PrimitiveSiuInvestigatorAvailability = "siu-investigator-availability";
    public const string PrimitivePolicyholderContactChannel  = "policyholder-contact-channel";
    public const string PrimitiveDocumentReviewChannel       = "document-review-channel";
    public const string PrimitivePaymentOpsSignal            = "payment-ops-signal";

    public Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        if (request.SourceBindings is null) return Task.FromResult<IReadOnlyList<ContextFragment>>([]);
        if (!request.SourceBindings.TryGetValue(SourceId, out var primitives) || primitives is null || primitives.Count == 0)
            return Task.FromResult<IReadOnlyList<ContextFragment>>([]);

        var seed = StableSeed(request.SubjectId);
        var combined = new List<ContextFragment>();
        foreach (var primitive in primitives)
        {
            if (string.IsNullOrEmpty(primitive)) continue;
            ContextFragment? frag = primitive switch
            {
                PrimitiveTriageThread                => BuildTriageThread(request.SubjectId, seed),
                PrimitiveAdjusterAvailability        => BuildAdjusterAvailability(request.SubjectId, seed),
                PrimitiveDamagePhotoThread           => BuildDamagePhotoThread(request.SubjectId, seed),
                PrimitiveShopCollabHistory           => BuildShopCollabHistory(request.SubjectId, seed),
                PrimitiveShopRelationshipSignal      => BuildShopRelationshipSignal(request.SubjectId, seed),
                PrimitiveSiuConsultChannel           => BuildSiuConsultChannel(request.SubjectId, seed),
                PrimitiveSiuInvestigatorAvailability => BuildSiuInvestigatorAvailability(request.SubjectId, seed),
                PrimitivePolicyholderContactChannel  => BuildPolicyholderContactChannel(request.SubjectId, seed),
                PrimitiveDocumentReviewChannel       => BuildDocumentReviewChannel(request.SubjectId, seed),
                PrimitivePaymentOpsSignal            => BuildPaymentOpsSignal(request.SubjectId, seed),
                _ => null,
            };
            if (frag is not null) combined.Add(frag);
        }
        return Task.FromResult<IReadOnlyList<ContextFragment>>(combined);
    }

    private static ContextFragment BuildSiuConsultChannel(string claim, uint seed)
    {
        string[] siuLeads = ["Diane Vasquez (SIU Lead, ring patterns)", "Tom Becker (SIU Lead, frequency clustering)", "Rachel Kim (SIU Senior, OEC-cert)", "Brendan O'Neil (SIU Senior)"];
        string[] notes = ["no prior SIU touches on this policyholder; clean profile",
                          "policyholder has one prior SIU referral 14 months ago, cleared with insufficient evidence",
                          "VIN appeared as third-party in one prior claim under a different policy 8 months ago",
                          "shop liaison flagged this repair-shop name as appearing on two prior watch-band scans"];
        var lead = Pick(seed, siuLeads.AsSpan());
        var note = Pick(seed >> 6, notes.AsSpan());
        int messages = 1 + (int)(seed % 5);
        int hoursAgo = 2 + (int)(seed % 60);

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Teams channel 'siu-consult-claims': {messages} messages this thread, latest {hoursAgo}h ago.");
        sb.AppendLine(inv, $"SIU lead consulted: {lead}.");
        sb.AppendLine(inv, $"Latest SIU note: \"{note}\"");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"TEAMS_THREAD/{claim}/siu-consult",
            Title: "SIU consult thread",
            Content: sb.ToString(),
            RelevanceScore: 0.88,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildPolicyholderContactChannel(string claim, uint seed)
    {
        string[] statuses = ["policyholder responsive (replied within 24h to last 2 messages)",
                             "policyholder slow-responsive (3-5 day reply turnaround)",
                             "policyholder unresponsive on the last 2 voicemails; legal-mail follow-up sent",
                             "policyholder requested all comms via email only"];
        string[] languages = ["English (default)", "Spanish (translation required per IL/CA disclosure rules if state matches)", "English; spouse co-insured CC'd on settlement comms"];
        var status = Pick(seed, statuses.AsSpan());
        var lang = Pick(seed >> 5, languages.AsSpan());
        int daysSince = 1 + (int)(seed % 20);

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Policyholder contact channel signal (last touched {daysSince}d ago):");
        sb.AppendLine(inv, $"- Status: {status}");
        sb.AppendLine(inv, $"- Language preference: {lang}");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"TEAMS_THREAD/{claim}/policyholder-contact",
            Title: "Policyholder contact signal",
            Content: sb.ToString(),
            RelevanceScore: 0.80,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildDocumentReviewChannel(string claim, uint seed)
    {
        string[] reviewers = ["Legal Review queue (avg 2 business days)", "Compliance Reviewer Alvarez (CA/TX templates)", "Compliance Reviewer Wu (NY/MA templates)", "Self-service template library (no human review needed)"];
        var reviewer = Pick(seed, reviewers.AsSpan());
        int templateRevisions = (int)(seed % 4);
        bool spanishCoSign = (seed % 6) == 0;

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Disclosure-letter review queue signal:");
        sb.AppendLine(inv, $"- Reviewer/route: {reviewer}");
        sb.AppendLine(inv, $"- Template revisions in last 90 days: {templateRevisions}");
        if (spanishCoSign)
            sb.AppendLine("  NOTE: Spanish translation co-sign required for this state-template combination.");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"SHAREPOINT_FILE/disclosure-review/{claim}",
            Title: "Disclosure-letter review signal",
            Content: sb.ToString(),
            RelevanceScore: 0.78,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildPaymentOpsSignal(string claim, uint seed)
    {
        string[] opsNotes = ["payment-ops queue normal; no exceptions on file",
                             "policyholder ACH info on file and verified within last 30 days",
                             "lienholder Wells Fargo confirmed payoff amount yesterday via FedLine wire",
                             "policyholder changed bank account 8 days ago — soft fraud signal, callback verification required",
                             "policyholder enrolled in two-party check workflow (no ACH on file)"];
        var note = Pick(seed, opsNotes.AsSpan());
        int avgClearDays = 1 + (int)(seed % 5);
        bool anomalyFlag = (seed % 4) == 0 && note.Contains("changed bank account");

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Payment-ops collaboration signal:");
        sb.AppendLine(inv, $"- Operations note: {note}");
        sb.AppendLine(inv, $"- Average funds-clear time: {avgClearDays} business days");
        if (anomalyFlag)
            sb.AppendLine("  NOTE: anomaly flag — payment routing should drop confidence below 0.55 and route to HITL.");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"TEAMS_THREAD/{claim}/payment-ops",
            Title: "Payment-ops channel signal",
            Content: sb.ToString(),
            RelevanceScore: anomalyFlag ? 0.92 : 0.82,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildSiuInvestigatorAvailability(string claim, uint seed)
    {
        int invId = 100 + (int)(seed % 400);
        string[] specialties = ["frequency-clustering", "ring-patterns", "sequence-signals", "OEC-certified (priority-band)"];
        var specialty = Pick(seed, specialties.AsSpan());
        int tenureYears = 3 + (int)(seed % 18); // 3-20 years
        int activeInvestigations = 2 + (int)(seed % 12); // 2-13 active
        bool overCapacity = activeInvestigations > 9;

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Candidate SIU investigator SIU-INV-{invId} availability signal:");
        sb.AppendLine(inv, $"- Pattern specialty: {specialty}");
        sb.AppendLine(inv, $"- Tenure: {tenureYears} years");
        sb.AppendLine(inv, $"- Active investigations: {activeInvestigations}");
        if (overCapacity)
            sb.AppendLine("  NOTE: investigator is over typical capacity; cycle time may extend by 5-7 days.");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"CALENDAR_SIGNAL/SIU-INV-{invId}/availability",
            Title: $"SIU investigator SIU-INV-{invId} availability",
            Content: sb.ToString(),
            RelevanceScore: 0.83,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    // SHA-256-truncated stable seed. Same claim number → same seed across runs → reproducible demos.
    private static uint StableSeed(string subjectId)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(subjectId));
        return BitConverter.ToUInt32(bytes, 0);
    }

    private static T Pick<T>(uint seed, ReadOnlySpan<T> options)
        => options[(int)(seed % (uint)options.Length)];

    // Build a Teams thread fragment for triage-time supervisor/SIU consultation.
    private static ContextFragment BuildTriageThread(string claim, uint seed)
    {
        string[] supervisors  = ["Sarah Lee (Senior Adjuster)", "Marcus Whitfield (Claims Supervisor)", "Priya Iyer (Triage Lead)", "Dave Okonkwo (Branch Manager)"];
        string[] siuAnglesNo  = ["no SIU concerns raised; pattern is consistent with regional baseline.",
                                "narrative checks out against the policyholder's tenure history.",
                                "geographic match looks ordinary for the incident type."];
        string[] siuAnglesYes = ["SIU may want a look; the incident hour aligns with a pattern flagged in May.",
                                "supervisor suggested holding for one SIU pass before assignment.",
                                "fraud-indicator scan flagged one signal — supervisor requested human eyes."];

        bool siuConcern = seed % 4 == 0; // 25% of claims get an SIU angle
        var supervisor = Pick(seed, supervisors.AsSpan());
        var angle = siuConcern ? Pick(seed >> 8, siuAnglesYes.AsSpan()) : Pick(seed >> 8, siuAnglesNo.AsSpan());
        var messages = 2 + (int)(seed % 6); // 2-7 messages in the thread
        var ageMin = 15 + (int)(seed % 240); // 15-255 min ago

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Teams thread 'triage-support': {messages} messages, latest {ageMin} min ago.");
        sb.AppendLine(inv, $"Senior reviewer: {supervisor}.");
        sb.AppendLine(inv, $"Latest message: \"{angle}\"");
        if (siuConcern)
            sb.AppendLine("Recommended action: route to senior adjuster pool, flag for SIU pre-screen.");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"TEAMS_THREAD/{claim}/triage-support",
            Title: "Triage-support Teams thread",
            Content: sb.ToString(),
            RelevanceScore: siuConcern ? 0.92 : 0.78,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildAdjusterAvailability(string claim, uint seed)
    {
        // Pull a synthetic adjuster id. AdjusterRoster MCP tool uses ADJ-NNNN format.
        int adjId = 1000 + (int)(seed % 9000);
        string[] availability = ["available, no calendar conflicts in the next 48h",
                                "available; one tentative meeting Thursday afternoon",
                                "out-of-office Friday (PTO); back Monday",
                                "high current load (12 active claims) — supervisor flagged this morning",
                                "on a different escalation; expected free in 4-6h"];
        var sig = Pick(seed >> 4, availability.AsSpan());
        var teamsPresence = (seed % 3) switch { 0u => "Available", 1u => "Busy", _ => "Away" };
        var calendarMisses = (int)(seed % 4); // 0-3 calendar declines this week

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Candidate adjuster ADJ-{adjId} availability signal:");
        sb.AppendLine(inv, $"- Teams presence: {teamsPresence}");
        sb.AppendLine(inv, $"- Calendar status: {sig}");
        sb.AppendLine(inv, $"- Calendar declines this week: {calendarMisses}");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"CALENDAR_SIGNAL/ADJ-{adjId}/availability",
            Title: $"Adjuster ADJ-{adjId} availability",
            Content: sb.ToString(),
            RelevanceScore: 0.80,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildDamagePhotoThread(string claim, uint seed)
    {
        int photoCount = 2 + (int)(seed % 9); // 2-10 photos
        int acknowledged = (int)(seed % (uint)(photoCount + 1));
        var network = (seed % 3) switch
        {
            0u => "policyholder uploaded directly; not yet acknowledged by network shop",
            1u => "policyholder uploaded; carrier ops acknowledged",
            _  => "policyholder uploaded; one Tier-1 shop responded within 2h with preliminary scope",
        };
        int hoursAgo = 1 + (int)(seed % 36);

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"SharePoint photo-share thread 'damage-{claim}':");
        sb.AppendLine(inv, $"- {photoCount} photos shared {hoursAgo}h ago, {acknowledged} acknowledged");
        sb.AppendLine(inv, $"- Network coordination: {network}");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"SHAREPOINT_THREAD/{claim}/damage-photos",
            Title: $"Damage photo-share for {claim}",
            Content: sb.ToString(),
            RelevanceScore: 0.85,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildShopCollabHistory(string claim, uint seed)
    {
        string[] shops = ["BodyPro Auto (DRP, OEM-cert: BMW, Audi)", "FairlanePoint Collision (Tier-2)", "Apex Coachworks (DRP, Tier-1)", "RegionOne Body (Tier-2)"];
        var shop = Pick(seed, shops.AsSpan());
        int priorJobs = 1 + (int)(seed % 14);
        double avgCycleDays = 4.5 + (double)(seed % 50) / 10.0; // 4.5-9.4 days
        int onTimeBudget = 75 + (int)(seed % 21); // 75-95% on-time delivery
        int complaintsLast90 = (int)(seed % 5); // 0-4 complaints

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Shop liaison collaboration history (last 90 days):");
        sb.AppendLine(inv, $"- Candidate shop: {shop}");
        sb.AppendLine(inv, $"- Prior jobs for this carrier: {priorJobs}");
        sb.AppendLine(inv, $"- Average cycle time: {avgCycleDays:F1} days");
        sb.AppendLine(inv, $"- On-budget delivery rate: {onTimeBudget}%");
        sb.AppendLine(inv, $"- Outstanding complaints (90d): {complaintsLast90}");
        if (complaintsLast90 >= 3)
            sb.AppendLine("  NOTE: hard exclusion threshold (>3) — per PAC-SHOP-001 do not route here without override.");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"SHAREPOINT_FILE/shop-history/{claim}",
            Title: "Shop liaison collaboration",
            Content: sb.ToString(),
            RelevanceScore: 0.82,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }

    private static ContextFragment BuildShopRelationshipSignal(string claim, uint seed)
    {
        // Different fragment to differentiate route_shop from estimate_repair — focus on TODAY's availability.
        string[] urgencies = ["earliest in-network appointment 2-3 days out",
                              "all network shops booked through end of week — next available Monday",
                              "two Tier-1 shops have weekend openings",
                              "one Tier-2 shop offered same-day intake"];
        var urgency = Pick(seed, urgencies.AsSpan());
        var supervisorNote = (seed % 2) == 0
            ? "Supervisor flagged: prefer in-state DRP if available."
            : "No supervisor note attached.";

        var inv = CultureInfo.InvariantCulture;
        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Shop network availability signal (Teams 'shop-routing' channel):");
        sb.AppendLine(inv, $"- {urgency}");
        sb.AppendLine(inv, $"- {supervisorNote}");

        return new ContextFragment(
            SourceId: "WorkIQ",
            DocId: $"TEAMS_THREAD/{claim}/shop-routing",
            Title: "Shop routing collaboration signal",
            Content: sb.ToString(),
            RelevanceScore: 0.78,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Collaboration, ContextDimension.Temporal]);
    }
}
