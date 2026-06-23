using System.Text.Json;
using System.Text.Json.Nodes;
using Adp.ToolRuntime;

namespace Adp.UseCases.Banking.Tools;

// Banking-side MCP tool implementations. Mirrors the Meridian tool shape — synthetic data drawn from
// the ambient claim/loan-application context that the orchestrator has already loaded. Per ADR-0001
// v0.6 amendment, lives under usecases/<x>/tools/ — platform/src/ never imports from this assembly,
// but TracesApi and PackageCompiler reference it as part of the runtime composition.

public sealed class BorrowerProfileTool : IMcpTool
{
    public string Id => "tool.borrower-profile";
    public string Description => "Fetch the borrower's full profile (identity, income source, address history, existing-debt summary) by applicationId.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "applicationId": { "type": "string", "description": "Loan application id, e.g. LOAN-2026-00001" }
          },
          "required": ["applicationId"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var requested = args["applicationId"]?.GetValue<string>();
        if (!context.AmbientContext.TryGetValue("claim", out var claimJson) || claimJson is null)
            return Task.FromResult(new ToolResult("{}", false, "No loan application in ambient context."));

        var application = JsonNode.Parse(claimJson);
        var actualId = application?["applicationId"]?.GetValue<string>();
        if (requested is not null && actualId is not null && requested != actualId)
            return Task.FromResult(new ToolResult("{}", false, $"Application '{requested}' not found. Available: {actualId}."));

        var applicant = application?["applicant"];
        if (applicant is null)
            return Task.FromResult(new ToolResult("{}", false, "Applicant block missing."));

        // Return applicant + existingDebt subtree as the borrower profile.
        var profile = new
        {
            applicationId = actualId,
            identity = new
            {
                fullName = applicant["fullName"]?.GetValue<string>(),
                dateOfBirth = applicant["dateOfBirth"]?.GetValue<string>(),
                ssnLast4 = applicant["ssnLast4"]?.GetValue<string>(),
                state = applicant["addressState"]?.GetValue<string>(),
                addressYearsHere = applicant["addressYearsHere"]?.GetValue<int>(),
            },
            employment = new
            {
                employerName = applicant["employerName"]?.GetValue<string>(),
                tenureYears = applicant["employerTenureYears"]?.GetValue<int>(),
                incomeSource = applicant["incomeSource"]?.GetValue<string>(),
                grossAnnualIncome = applicant["grossAnnualIncome"]?.GetValue<int>(),
                monthlyIncome = applicant["monthlyIncome"]?.GetValue<int>(),
                incomeVerified = applicant["incomeVerified"]?.GetValue<bool>(),
            },
            existingDebt = application?["existingDebt"],
            note = "v0 synthetic profile sourced from ambient application; v1 calls bureau-of-record."
        };

        return Task.FromResult(new ToolResult(JsonSerializer.Serialize(profile), true));
    }
}

public sealed class CreditBureauLookupTool : IMcpTool
{
    public string Id => "tool.credit-bureau-lookup";
    public string Description => "Pull the borrower's tri-bureau merged credit report (FICO + score components + recent inquiries) by applicationId.";
    public string ParametersJsonSchema => """
        {
          "type": "object",
          "properties": {
            "applicationId": { "type": "string", "description": "Loan application id" }
          },
          "required": ["applicationId"]
        }
        """;

    public Task<ToolResult> InvokeAsync(string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var args = JsonNode.Parse(argumentsJson) ?? throw new InvalidDataException("invalid args JSON");
        var requested = args["applicationId"]?.GetValue<string>();
        if (!context.AmbientContext.TryGetValue("claim", out var claimJson) || claimJson is null)
            return Task.FromResult(new ToolResult("{}", false, "No loan application in ambient context."));

        var application = JsonNode.Parse(claimJson);
        var actualId = application?["applicationId"]?.GetValue<string>();
        if (requested is not null && actualId is not null && requested != actualId)
            return Task.FromResult(new ToolResult("{}", false, $"Application '{requested}' not found. Available: {actualId}."));

        var bureau = application?["creditBureau"];
        if (bureau is null)
            return Task.FromResult(new ToolResult("{}", false, "Credit bureau data not present in application."));

        // Synthesize a few extras to make the bureau report feel realistic.
        var middle = bureau["middleScore"]?.GetValue<int>() ?? 700;
        var inquiriesLast12 = (middle % 17) % 7; // 0-6 deterministic from score
        var openTradelines = 4 + (middle % 9); // 4-12 deterministic
        var oldestAccountYears = 3 + (middle % 25); // 3-27 deterministic

        var report = new
        {
            applicationId = actualId,
            experianFico = bureau["experianFico"]?.GetValue<int>(),
            equifaxFico = bureau["equifaxFico"]?.GetValue<int>(),
            transunionFico = bureau["transunionFico"]?.GetValue<int>(),
            middleScore = middle,
            verified = bureau["verified"]?.GetValue<bool>(),
            inquiriesLast12Months = inquiriesLast12,
            openTradelines = openTradelines,
            oldestAccountYears = oldestAccountYears,
            recentDelinquencies = middle < 620 ? 1 + (middle % 3) : 0,
            note = "v0 synthetic enhancements derived deterministically from FICO; v1 calls real ISO ClaimSearch / bureau APIs."
        };

        return Task.FromResult(new ToolResult(JsonSerializer.Serialize(report), true));
    }
}

public static class BankingToolRegistry
{
    public static ToolRegistry CreateDefault()
    {
        var r = new ToolRegistry();
        r.Register(new BorrowerProfileTool());
        r.Register(new CreditBureauLookupTool());
        return r;
    }

    public const string Industry = "banking";
}
