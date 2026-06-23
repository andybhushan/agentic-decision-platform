namespace Adp.PackageCompiler.Stages;

internal static class Stage2_SemanticValidate
{
    public static Task RunAsync(CompileContext ctx)
    {
        Console.WriteLine("[2/4] Semantic validate");
        var pkg = ctx.Package!;
        var errors = new List<string>();

        var agentIds = pkg.Agents.Select(a => a.Id).ToHashSet(StringComparer.Ordinal);
        var skillIds = pkg.Skills.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);

        foreach (var refId in pkg.DigitalWorker.AgentRefs)
            if (!agentIds.Contains(refId))
                errors.Add($"digitalWorker.agentRefs contains '{refId}' but no agent with that id exists");

        foreach (var agent in pkg.Agents)
            foreach (var sref in agent.SkillRefs)
                if (!skillIds.Contains(sref))
                    errors.Add($"agent '{agent.Id}' references unknown skill '{sref}'");

        if (pkg.DigitalWorker.Orchestration.BoundedReasoningZones is { } zones)
            foreach (var zone in zones)
                foreach (var allowedAgent in zone.AllowedAgents)
                    if (!agentIds.Contains(allowedAgent))
                        errors.Add($"boundedReasoningZone '{zone.ZoneId}' allows unknown agent '{allowedAgent}'");

        var slos = pkg.DigitalWorker.Slos;
        if (slos.Count == 0)
            errors.Add("digitalWorker.slos is empty — at least one SLO is required for accountability");

        var hitlGates = pkg.DigitalWorker.Orchestration.HitlGates ?? [];
        var seenGateIds = new HashSet<string>();
        foreach (var gate in hitlGates)
            if (!seenGateIds.Add(gate.GateId))
                errors.Add($"duplicate HITL gateId '{gate.GateId}'");

        if (errors.Count > 0)
            throw new CompileException("semantic-validate", $"{errors.Count} semantic issue(s) found.", errors);

        Console.WriteLine($"      ok: {pkg.Agents.Count} agents · {pkg.Skills.Count} skills · {pkg.Tools.Count} tools · {pkg.DigitalWorker.Slos.Count} SLO(s)");
        return Task.CompletedTask;
    }
}
