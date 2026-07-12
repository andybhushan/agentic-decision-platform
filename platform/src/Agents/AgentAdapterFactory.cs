namespace Adp.Agents;

// Picks the right IAgentAdapter from environment:
//   AGENT_BACKEND=foundry (or unset + FOUNDRY_PROJECT_ENDPOINT present) → FoundryAdapter (Foundry Agent Service, Entra RBAC)
//   AGENT_BACKEND=agent-framework → AgentFrameworkAdapter (Microsoft Agent Framework in-process, key auth)
//   AGENT_BACKEND=legacy (or FOUNDRY_PROJECT_ENDPOINT absent + AZURE_OPENAI_* present) → LegacyOpenAIAdapter (chat-completions)
//   neither → throw
//
// Lets the cloud Function and CLI use the same selection logic.
public static class AgentAdapterFactory
{
    public static IAgentAdapter FromEnvironment()
    {
        var backend = (Environment.GetEnvironmentVariable("AGENT_BACKEND") ?? "").Trim().ToLowerInvariant();
        var foundryEndpoint = Environment.GetEnvironmentVariable("FOUNDRY_PROJECT_ENDPOINT");
        var aoaiEndpoint    = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var aoaiKey         = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");

        if (backend == "foundry") return FoundryAdapter.FromEnvironment();
        if (backend == "legacy")  return LegacyOpenAIAdapter.FromEnvironment();
        if (backend is "agent-framework" or "agentframework") return AgentFrameworkAdapter.FromEnvironment();

        // Auto-pick: prefer Foundry if endpoint set; fall back to legacy AOAI if creds present.
        if (!string.IsNullOrEmpty(foundryEndpoint)) return FoundryAdapter.FromEnvironment();
        if (!string.IsNullOrEmpty(aoaiEndpoint) && !string.IsNullOrEmpty(aoaiKey))
            return LegacyOpenAIAdapter.FromEnvironment();

        throw new InvalidOperationException(
            "No agent backend configured. Set FOUNDRY_PROJECT_ENDPOINT (v1) or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY (legacy).");
    }
}
