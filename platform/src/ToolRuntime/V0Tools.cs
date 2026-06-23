namespace Adp.ToolRuntime;

// v0.6 (post-Track-4): platform/src/ToolRuntime/ owns ONLY the IMcpTool / IToolRegistry / ToolRegistry
// contracts (defined in IMcpTool.cs) and the IndustryAwareToolRegistry composer (below). All concrete
// tool implementations have been relocated to use-case-side projects:
//   - usecases/meridian-pnc-auto-claims/tools/MeridianTools.csproj  (4 P&C tools)
//   - usecases/banking-loan-origination/tools/BankingTools.csproj  (2 banking tools)
//
// TracesApi.csproj and PackageCompiler.csproj reference both use-case tool projects directly — per
// ADR-0001 v0.6 amendment, the platform→usecase import ban does not apply to tool runtime composition
// (the tool kits ARE the runtime side of the package contract).

/// <summary>
/// Composes per-industry tool registries into one logical registry. The TracesApi DI resolves the
/// industry-appropriate sub-registry per package at execute time via <see cref="ForIndustry"/>.
/// </summary>
public sealed class IndustryAwareToolRegistry : IToolRegistry
{
    private readonly Dictionary<string, IToolRegistry> _byIndustry;
    private readonly IToolRegistry _fallback;

    public IndustryAwareToolRegistry(IReadOnlyDictionary<string, IToolRegistry> byIndustry, IToolRegistry? fallback = null)
    {
        _byIndustry = new Dictionary<string, IToolRegistry>(byIndustry, StringComparer.OrdinalIgnoreCase);
        _fallback = fallback ?? new ToolRegistry();
    }

    // Composite All view across every registered industry — useful when an agent needs the full surface.
    public IReadOnlyCollection<IMcpTool> All
        => _byIndustry.Values.SelectMany(r => r.All).Distinct().ToList();

    public IMcpTool? GetById(string id)
    {
        foreach (var r in _byIndustry.Values)
        {
            var t = r.GetById(id);
            if (t is not null) return t;
        }
        return _fallback.GetById(id);
    }

    public Task<ToolResult> InvokeAsync(string toolId, string argumentsJson, ToolInvocationContext context, CancellationToken cancellationToken = default)
    {
        var t = GetById(toolId);
        if (t is null) return Task.FromResult(new ToolResult("{}", false, $"Unknown tool '{toolId}'"));
        return t.InvokeAsync(argumentsJson, context, cancellationToken);
    }

    /// <summary>Pick the industry-specific sub-registry (e.g., for a package whose Package.Industry = "insurance").</summary>
    public IToolRegistry ForIndustry(string industry)
        => _byIndustry.TryGetValue(industry, out var r) ? r : _fallback;
}
