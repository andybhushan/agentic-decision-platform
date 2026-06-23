using System.Text.Json;
using Adp.PackageModel;

namespace Adp.PackageCompiler.Stages;

internal static class Stage3_PlanGenerate
{
    public static async Task RunAsync(CompileContext ctx)
    {
        Console.WriteLine("[3/4] Plan generate");
        var pkg = ctx.Package!;

        Directory.CreateDirectory(ctx.StagingDir);
        Directory.CreateDirectory(Path.Combine(ctx.StagingDir, "foundry"));
        Directory.CreateDirectory(Path.Combine(ctx.StagingDir, "durable"));
        Directory.CreateDirectory(Path.Combine(ctx.StagingDir, "mcp"));

        // The canonical package itself
        await File.WriteAllTextAsync(Path.Combine(ctx.StagingDir, "package.json"), ctx.RawJson);

        // Foundry agent definitions — one file per agent
        var foundryDefs = pkg.Agents.Select(a => new
        {
            id = a.Id,
            name = a.Capability,
            kind = a.Kind,
            model = a.FoundryModel ?? "gpt-4o",
            deploymentTarget = a.DeploymentTarget ?? "foundry-agent-service",
            instructions = a.SystemPrompt,
            tools = pkg.Tools.Select(t => new { t.Id, t.McpEndpoint }).ToList(),
            confidence = a.ConfidenceCalibration,
        }).ToList();
        await WriteJsonAsync(Path.Combine(ctx.StagingDir, "foundry", "agents.json"), foundryDefs);

        // Durable Function orchestration plan
        var durablePlan = new
        {
            digitalWorker = pkg.DigitalWorker.Id,
            strategy = pkg.DigitalWorker.Orchestration.Strategy,
            stepFormation = pkg.DigitalWorker.Orchestration.StepFormation,
            steps = pkg.DigitalWorker.AgentRefs.Select((id, i) => new
            {
                stepId = $"s{i + 1}",
                agentId = id,
            }).ToList(),
            invariants = pkg.DigitalWorker.Orchestration.Invariants ?? [],
            hitlGates = pkg.DigitalWorker.Orchestration.HitlGates ?? [],
            boundedReasoningZones = pkg.DigitalWorker.Orchestration.BoundedReasoningZones ?? [],
            slos = pkg.DigitalWorker.Slos,
        };
        await WriteJsonAsync(Path.Combine(ctx.StagingDir, "durable", "orchestrator-plan.json"), durablePlan);

        // MCP tool catalog
        var mcpCatalog = pkg.Tools.Select(t => new
        {
            id = t.Id,
            name = t.Name,
            endpoint = t.McpEndpoint,
            auth = t.Auth,
            backend = t.BackendComponent,
        }).ToList();
        await WriteJsonAsync(Path.Combine(ctx.StagingDir, "mcp", "tools.json"), mcpCatalog);

        Console.WriteLine($"      ok: staged in {ctx.StagingDir}");
        Console.WriteLine($"      foundry/ ({foundryDefs.Count} agents) · durable/ (1 plan) · mcp/ ({mcpCatalog.Count} tools)");
    }

    private static async Task WriteJsonAsync<T>(string path, T value)
    {
        var json = JsonSerializer.Serialize(value, AgentPackageSerializer.Options);
        await File.WriteAllTextAsync(path, json);
    }
}
