using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Adp.Agents;
using Adp.ContextLayer;
using Adp.DecisionIngest;
using Adp.Orchestration;
using Adp.ToolRuntime;
using Adp.TracesApi;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();

// Read-side
builder.Services.AddSingleton(_ => DwStateReader.FromEnvironment());

// Agent runtime + retrieval + tools — singletons, reused across activity invocations within a worker instance.
// The registry holds every backend the environment supports (agent-framework, foundry, legacy);
// AGENT_BACKEND names the default and a run may override per invocation.
builder.Services.AddSingleton(_ => AdapterRegistry.FromEnvironment());
builder.Services.AddSingleton<IAgentAdapter>(sp => sp.GetRequiredService<AdapterRegistry>().Default);
builder.Services.AddSingleton(_ => EmbeddingService.FromEnvironment());
// Context layer: Foundry IQ (Azure AI Search vector) + FabricIQ + Work IQ (stub).
//
// FabricIQ backend selection (per ADR-0011):
//   SEMANTIC_BACKEND=fabric  → FabricLakehouseSource (Fabric Lakehouse SQL endpoint, AAD auth, D11)
//   SEMANTIC_BACKEND=sql     → SqlSemanticLayerSource (Azure SQL Basic SKU, D10) — explicit
//   SEMANTIC_BACKEND unset   → SqlSemanticLayerSource if AZURE_SQL_CONNECTION set; else stub
// The migration v0 → v1 is one env-var flip on the Function app. No code change.
builder.Services.AddSingleton<IContextSource>(_ =>
{
    var backend = (Environment.GetEnvironmentVariable("SEMANTIC_BACKEND") ?? "").Trim().ToLowerInvariant();
    var fabricConn = Environment.GetEnvironmentVariable("FABRIC_LAKEHOUSE_CONNECTION");
    var sqlConn    = Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTION");

    if (backend == "fabric")
    {
        if (string.IsNullOrEmpty(fabricConn))
            throw new InvalidOperationException("SEMANTIC_BACKEND=fabric requires FABRIC_LAKEHOUSE_CONNECTION.");
        return new FabricLakehouseSource(fabricConn);
    }
    if (backend == "sql")
    {
        if (string.IsNullOrEmpty(sqlConn))
            throw new InvalidOperationException("SEMANTIC_BACKEND=sql requires AZURE_SQL_CONNECTION.");
        return new SqlSemanticLayerSource(sqlConn);
    }
    // Auto-select: prefer SQL if configured, else stub (e.g. local dev).
    return !string.IsNullOrEmpty(sqlConn)
        ? new SqlSemanticLayerSource(sqlConn)
        : (IContextSource)new StubFabricIqSource();
});
// Work IQ backend selection (Track 3 / ADR-0015): WORKIQ_BACKEND=graph → real Microsoft Graph (delegated
// scopes; only meaningful for local CLI runs where the user can sign in); WORKIQ_BACKEND=synthetic (or
// unset) → deterministic synthetic source. Cloud Function MI lacks Graph admin consent so we keep
// synthetic as the default.
IContextSource workIqSource = string.Equals(
        (Environment.GetEnvironmentVariable("WORKIQ_BACKEND") ?? "").Trim(),
        "graph", StringComparison.OrdinalIgnoreCase)
    ? new MicrosoftGraphWorkIqSource()
    : new WorkIqSource();
// Wave 3: the workspace's published Fabric Data Agent joins the federation when
// FABRIC_DATA_AGENT_URL is set. Degrades to empty fragments until the agent is published.
var dataAgentSource = FabricDataAgentSource.FromEnvironment();
builder.Services.AddSingleton<IContextRouter>(sp => new ContextRouter(
    dataAgentSource is null
        ? [
            AzureSearchFoundryIQSource.FromEnvironment(sp.GetRequiredService<EmbeddingService>()),
            sp.GetRequiredService<IContextSource>(),             // FabricIQ (SQL-backed or Fabric Lakehouse)
            workIqSource,                                        // synthetic by default; Graph if WORKIQ_BACKEND=graph
        ]
        : [
            AzureSearchFoundryIQSource.FromEnvironment(sp.GetRequiredService<EmbeddingService>()),
            sp.GetRequiredService<IContextSource>(),
            dataAgentSource,                                     // Fabric IQ Data Agent (NL over ontology+semantic model)
            workIqSource,
        ]));
// Track 4: industry-aware tool registry composes per-usecase tool kits at runtime.
// New use cases add a Tools.csproj under usecases/<x>/tools/ and a single line below.
builder.Services.AddSingleton<IToolRegistry>(_ => new IndustryAwareToolRegistry(
    new Dictionary<string, IToolRegistry>(StringComparer.OrdinalIgnoreCase)
    {
        [Adp.UseCases.Meridian.Tools.MeridianToolRegistry.Industry]     = Adp.UseCases.Meridian.Tools.MeridianToolRegistry.CreateDefault(),
        [Adp.UseCases.Banking.Tools.BankingToolRegistry.Industry] = Adp.UseCases.Banking.Tools.BankingToolRegistry.CreateDefault(),
    }));
builder.Services.AddSingleton(_ => new StepRunner(
    adapter: null!, contextRouter: null, toolRegistry: null));   // placeholder; activities resolve via DI

// Write-side sinks
builder.Services.AddSingleton(_ => DwStateWriter.FromEnvironment());

// Runtime subject intake (POST /api/intake, GET /api/records, queue merge)
builder.Services.AddSingleton(_ => IntakeStore.FromEnvironment());

// Evidence: blob-backed photo store + GPT-4o vision at intake (vision optional).
builder.Services.AddSingleton(_ => EvidenceStore.FromEnvironment());
builder.Services.AddSingleton(_ => new Lazy<EvidenceVision?>(() =>
{
    try { return EvidenceVision.FromEnvironment(); }
    catch { return null; }
}));

// SignalR sink requires async init — wrap in a Lazy<Task<>>.
builder.Services.AddSingleton(_ => new Lazy<Task<SignalRStepSink?>>(async () =>
{
    try { return await SignalRStepSink.FromEnvironmentAsync(); }
    catch { return null; }
}, LazyThreadSafetyMode.ExecutionAndPublication));

builder.Build().Run();
