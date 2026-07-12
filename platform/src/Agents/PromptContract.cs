using System.Text.Json;

namespace Adp.Agents;

// The prompt + response contract shared by every LLM-backed adapter (legacy chat-completions,
// Agent Framework, Foundry). One place defines how agents are instructed to ground, cite, and
// self-score, and how their JSON answer is parsed, so switching runtimes never changes decision
// semantics.
internal static class PromptContract
{
    // OpenAI function names allow [A-Za-z0-9_-]. Map dots from our tool IDs to underscores.
    internal static string ToFunctionName(string toolId) => toolId.Replace('.', '_').Replace('-', '_');

    internal static string BuildSystemMessage(AgentInvocationRequest req)
    {
        var ontology = req.Agent.OntologyBinding is { Count: > 0 } b
            ? "\n\nOntology entities you may reason over: " + string.Join(", ", b) + "."
            : "";

        var calibration = req.Agent.ConfidenceCalibration is { } c
            ? $"\n\nConfidence guidance: report < {c.LowThreshold:F2} if the evidence is materially ambiguous; "
              + $"≥ {c.HighThreshold:F2} only when the answer is clear and supported by cited fields."
            : "";

        var toolNote = req.Tools is not null && req.Tools.All.Count > 0
            ? "\n\nYou have access to function-call tools. Use them to fetch data you need before answering. "
              + "Do not invent data when a tool can provide it."
            : "";

        return $$"""
            {{req.Agent.SystemPrompt}}{{ontology}}{{calibration}}{{toolNote}}

            When you have enough information to answer, respond with a single JSON object in this exact shape:
            {
              "output": "<1-3 sentence summary of your decision or extracted result>",
              "confidence": <number between 0 and 1>,
              "citedSources": ["<source identifier 1>", "<source identifier 2>", ...]
            }

            "citedSources" identifies what you actually used to reach your decision. Use:
              - Knowledge document IDs (e.g. PAC-COV-001) when you relied on the ### knowledge ### section.
              - Specific input field names (e.g. claim.policy.coverages) when you relied on the claim data.
              - Tool names (e.g. tool.adjuster-roster) when you relied on a tool result.
              - Previous step labels (e.g. coverage-verification) when you relied on a prior agent's conclusion.
            If you reasoned without grounding in any provided source, return an empty array — DO NOT invent citations.
            Do not include any text outside the JSON object.
            """;
    }

    internal static string BuildUserMessage(AgentInvocationRequest req)
    {
        var contextBlock = req.ContextSnippets.Count == 0
            ? "(no additional context provided)"
            : string.Join("\n", req.ContextSnippets.Select(kv => $"### {kv.Key}\n{kv.Value}"));

        return $"""
            Intent: {req.Intent}
            Subject: {req.SubjectId}

            Input:
            {contextBlock}
            """;
    }

    internal sealed record ParsedResponse(string Output, double Confidence, IReadOnlyList<string> CitedSources);

    internal static ParsedResponse TryParse(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var output = root.TryGetProperty("output", out var o) ? (o.GetString() ?? raw) : raw;
            var confidence = root.TryGetProperty("confidence", out var c) && c.TryGetDouble(out var cd) ? cd : 0.6;
            var cited = new List<string>();
            if (root.TryGetProperty("citedSources", out var cs) && cs.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in cs.EnumerateArray())
                    if (el.ValueKind == JsonValueKind.String && el.GetString() is { Length: > 0 } s)
                        cited.Add(s);
            }
            return new ParsedResponse(output, confidence, cited);
        }
        catch
        {
            return new ParsedResponse(raw, 0.6, []);
        }
    }
}
