using System.Collections.Concurrent;

namespace Adp.Agents;

// Runtime portability made switchable: every backend the environment can support is
// registered by name and created lazily on first use; a run may name its backend and the
// platform executes it on that runtime, with AGENT_BACKEND remaining the default. This is
// the demonstrable version of the portability claim: same package, same subject, choose
// Microsoft Agent Framework or Azure AI Foundry Agent Service per run and diff the journal.
public sealed class AdapterRegistry
{
    private readonly ConcurrentDictionary<string, Lazy<IAgentAdapter>> _byName = new(StringComparer.OrdinalIgnoreCase);

    public string DefaultName { get; }

    private AdapterRegistry(string defaultName) => DefaultName = defaultName;

    public static AdapterRegistry FromEnvironment()
    {
        var backend = (Environment.GetEnvironmentVariable("AGENT_BACKEND") ?? "").Trim().ToLowerInvariant();
        var foundryEndpoint = Environment.GetEnvironmentVariable("FOUNDRY_PROJECT_ENDPOINT");
        var aoaiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var aoaiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");

        var hasAoai = !string.IsNullOrEmpty(aoaiEndpoint) && !string.IsNullOrEmpty(aoaiKey);
        var hasFoundry = !string.IsNullOrEmpty(foundryEndpoint);

        var defaultName = backend switch
        {
            "foundry" => "foundry",
            "legacy" => "legacy",
            "agent-framework" or "agentframework" => "agent-framework",
            _ when hasFoundry => "foundry",
            _ when hasAoai => "legacy",
            _ => throw new InvalidOperationException(
                "No agent backend configured. Set FOUNDRY_PROJECT_ENDPOINT or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY."),
        };

        var registry = new AdapterRegistry(defaultName);
        if (hasAoai)
        {
            registry._byName["agent-framework"] = new Lazy<IAgentAdapter>(AgentFrameworkAdapter.FromEnvironment);
            registry._byName["legacy"] = new Lazy<IAgentAdapter>(LegacyOpenAIAdapter.FromEnvironment);
        }
        if (hasFoundry)
        {
            registry._byName["foundry"] = new Lazy<IAgentAdapter>(FoundryAdapter.FromEnvironment);
        }
        return registry;
    }

    public IReadOnlyList<string> Available => [.. _byName.Keys.OrderBy(k => k, StringComparer.Ordinal)];

    public IAgentAdapter Default => Resolve(null);

    // Unknown or unavailable names fall back to the default rather than failing the run.
    public IAgentAdapter Resolve(string? name)
    {
        var key = string.IsNullOrWhiteSpace(name) ? DefaultName : name.Trim().ToLowerInvariant();
        if (key == "agentframework") key = "agent-framework";
        if (_byName.TryGetValue(key, out var lazy)) return lazy.Value;
        return _byName.TryGetValue(DefaultName, out var def)
            ? def.Value
            : throw new InvalidOperationException($"No adapter registered for '{name}' and no default available.");
    }
}
