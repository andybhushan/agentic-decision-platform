using System.Text.Json;
using System.Text.Json.Nodes;
using Adp.ToolRuntime;

namespace Adp.UseCases.Meridian.Tools;

// Meridian-side MCP tool implementations (Track 4 — relocated from platform/src/ToolRuntime).
// Per ADR-0001 v0.6 amendment: tool kits are the use case's contribution to the runtime;
// platform owns only IMcpTool / IToolRegistry contracts. TracesApi + PackageCompiler reference
// the use-case Tools project(s) directly — acknowledged exception to the strict platform→usecase
// import ban because tool runtime is loaded from use cases.

public sealed class ClaimStoreTool : IMcpTool
{
    public string Id => "tool.claim-store";
    public string Description => "Returns the full claim record for a given claimNumber.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "claimNumber": { "type": "string", "description": "Claim number, e.g. CLM-2026-10000" }
          },
          "required": ["claimNumber"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var requested = args["claimNumber"]?.GetValue<string>();
        if (!context.AmbientContext.TryGetValue("claim", out var claimJson) || claimJson is null)
            return Task.FromResult(new ToolResult("{}", false, "No claim in ambient context."));

        var claim = JsonNode.Parse(claimJson);
        var actualNumber = claim?["claimNumber"]?.GetValue<string>();
        if (requested is not null && actualNumber is not null && requested != actualNumber)
            return Task.FromResult(new ToolResult("{}", false, $"Claim '{requested}' not found in v0 store. Available: {actualNumber}."));

        return Task.FromResult(new ToolResult(claimJson, true));
    }
}

public sealed class VehicleLookupTool : IMcpTool
{
    public string Id => "tool.vehicle-lookup";
    public string Description => "Decode a VIN and return vehicle make, model, year, and rough ACV estimate.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "vin": { "type": "string", "description": "17-character VIN" }
          },
          "required": ["vin"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var vin = args["vin"]?.GetValue<string>() ?? "";

        if (!context.AmbientContext.TryGetValue("claim", out var claimJson) || claimJson is null)
            return Task.FromResult(new ToolResult("{}", false, "No claim in ambient context."));

        var claim = JsonNode.Parse(claimJson);
        var vehicle = claim?["vehicle"];
        if (vehicle is null)
            return Task.FromResult(new ToolResult("{}", false, "Vehicle data not present."));

        var year = vehicle["year"]?.GetValue<int>() ?? 0;
        var ageYears = Math.Max(0, DateTime.UtcNow.Year - year);
        var baseAcv = 28000;
        var depreciated = baseAcv * Math.Pow(0.88, ageYears);
        var result = new
        {
            vin,
            vinMatched = string.Equals(vehicle["vin"]?.GetValue<string>(), vin, StringComparison.Ordinal),
            make = vehicle["make"]?.GetValue<string>(),
            model = vehicle["model"]?.GetValue<string>(),
            year,
            ageYears,
            actualCashValueUsd = (int)Math.Round(depreciated),
            note = "v0 synthetic ACV; v1 pulls from valuation provider.",
        };
        return Task.FromResult(new ToolResult(JsonSerializer.Serialize(result), true));
    }
}

public sealed class PolicyStoreTool : IMcpTool
{
    public string Id => "tool.policy-store";
    public string Description => "Fetch policy details (coverages, effective dates, deductibles) by policy number.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "policyNumber": { "type": "string" }
          },
          "required": ["policyNumber"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var requested = args["policyNumber"]?.GetValue<string>() ?? "";

        if (!context.AmbientContext.TryGetValue("claim", out var claimJson) || claimJson is null)
            return Task.FromResult(new ToolResult("{}", false, "No claim in ambient context."));

        var claim = JsonNode.Parse(claimJson);
        var policy = claim?["policy"];
        if (policy is null)
            return Task.FromResult(new ToolResult("{}", false, "Policy data not present."));

        var actualNumber = policy["policyNumber"]?.GetValue<string>();
        if (requested.Length > 0 && actualNumber is not null && requested != actualNumber)
        {
            var fallback = new { requested, found = false, hint = $"Policy '{requested}' not in v0 store. The claim references '{actualNumber}'." };
            return Task.FromResult(new ToolResult(JsonSerializer.Serialize(fallback), false, "not found"));
        }

        return Task.FromResult(new ToolResult(policy.ToJsonString(), true));
    }
}

public sealed class AdjusterRosterTool : IMcpTool
{
    private static readonly string[] CertsTotalLoss = ["low", "medium", "high", "total-loss"];
    private static readonly string[] CertsHigh = ["low", "medium", "high"];
    private static readonly string[] CertsMedium = ["low", "medium"];
    private static readonly string[] CertsLow = ["low"];

    public string Id => "tool.adjuster-roster";
    public string Description => "Search the adjuster roster by state and severity tier. Returns up to topK adjusters with current workload.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "state": { "type": "string", "description": "2-letter US state code, e.g. NY" },
            "tier":  { "type": "string", "enum": ["low", "medium", "high", "total-loss"], "description": "Severity tier the adjuster must be certified for" },
            "topK":  { "type": "integer", "minimum": 1, "maximum": 10, "default": 3 }
          },
          "required": ["state", "tier"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var state = args["state"]?.GetValue<string>() ?? "??";
        var tier = args["tier"]?.GetValue<string>() ?? "medium";
        var topK = args["topK"]?.GetValue<int>() ?? 3;

        var seed = StableHash(state + "|" + tier);
        var rnd = new Random(seed);
        var adjusters = Enumerable.Range(0, topK).Select(i =>
        {
            var id = $"ADJ-{1000 + rnd.Next(1, 999):D4}";
            var tenureYears = 1 + rnd.Next(0, 15);
            var activeClaims = rnd.Next(4, 22);
            var maxActive = 25;
            var certs = tier switch
            {
                "total-loss" => CertsTotalLoss,
                "high"       => CertsHigh,
                "medium"     => CertsMedium,
                _            => CertsLow,
            };
            return new
            {
                adjusterId = id,
                state,
                tenureYears,
                activeClaims,
                maxActiveClaims = maxActive,
                certifications = certs,
                siuLicensed = rnd.NextDouble() < 0.3,
            };
        }).OrderBy(a => a.activeClaims).ToList();

        var result = new { state, tier, count = adjusters.Count, adjusters };
        return Task.FromResult(new ToolResult(JsonSerializer.Serialize(result), true));
    }

    private static int StableHash(string s)
    {
        unchecked
        {
            const uint offset = 2166136261;
            const uint prime = 16777619;
            uint h = offset;
            foreach (var c in s) { h ^= c; h *= prime; }
            return (int)(h & 0x7FFFFFFF);
        }
    }
}

public static class MeridianToolRegistry
{
    public static ToolRegistry CreateDefault()
    {
        var r = new ToolRegistry();
        r.Register(new ClaimStoreTool());
        r.Register(new VehicleLookupTool());
        r.Register(new PolicyStoreTool());
        r.Register(new AdjusterRosterTool());
        return r;
    }

    public const string Industry = "insurance";
}
