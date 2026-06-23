using System.Text.Json;
using Adp.Agents;
using Adp.ContextLayer;
using Adp.Orchestration;
using Adp.DecisionIngest;
using Adp.PackageCompiler;
using Adp.PackageCompiler.Stages;
using Adp.PackageModel;
using Adp.ToolRuntime;

return await Cli.RunAsync(args);

namespace Adp.PackageCompiler
{
    internal static class Cli
    {
        public static async Task<int> RunAsync(string[] args)
        {
            if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
            {
                PrintUsage();
                return 0;
            }

            return args[0] switch
            {
                "compile"    => await CompileAsync(args[1..]),
                "execute"    => await ExecuteAsync(args[1..]),
                "index"      => await IndexAsync(args[1..]),
                "ingest"        => await IngestAsync(args[1..]),
                "show-state"    => await ShowStateAsync(args[1..]),
                "semantic-load" => await SemanticLoadAsync(args[1..]),
                _ => Fail($"unknown command: {args[0]}"),
            };
        }

        private static async Task<int> SemanticLoadAsync(string[] args)
        {
            string? corpus = null;
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--corpus" or "-c": corpus = args[++i]; break;
                    default:
                        if (corpus is null && !args[i].StartsWith('-')) corpus = args[i];
                        else return Fail($"unknown argument: {args[i]}");
                        break;
                }
            }
            if (corpus is null) return Fail("semantic-load: --corpus <path> is required");

            var connStr = Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTION");
            if (string.IsNullOrEmpty(connStr))
                return Fail("AZURE_SQL_CONNECTION env var required");

            Console.WriteLine($"adpc semantic-load {corpus}");
            var loader = new Adp.ContextLayer.SemanticLoader(connStr);
            var report = await loader.LoadAsync(corpus);
            Console.WriteLine($"  corpus: {report.ClaimsInCorpus} claims, {report.PolicyholdersInCorpus} policyholders, {report.VehiclesInCorpus} vehicles");
            Console.WriteLine($"  inserted (new only via MERGE): {report.ClaimsInserted} claims, {report.PolicyholdersInserted} policyholders, {report.VehiclesInserted} vehicles");
            Console.WriteLine();
            Console.WriteLine("OK: semantic layer populated.");
            return 0;
        }

        private static async Task<int> ShowStateAsync(string[] args)
        {
            string? subject = null;
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--subject" or "-s": subject = args[++i]; break;
                    default:
                        if (subject is null && !args[i].StartsWith('-')) subject = args[i];
                        else return Fail($"unknown argument: {args[i]}");
                        break;
                }
            }
            if (subject is null) return Fail("show-state: --subject <id> is required");

            using var reader = DwStateReader.FromEnvironment();
            var rows = await reader.ListBySubjectAsync(subject);
            Console.WriteLine($"adpc show-state --subject {subject}");
            Console.WriteLine($"  rows: {rows.Count}");
            if (rows.Count > 0)
            {
                var first = rows[0];
                Console.WriteLine($"  package: {first.PackageId}@{first.PackageVersion} ({first.AgentCount} agents · {first.SkillCount} skills · {first.ToolCount} tools)");
            }
            Console.WriteLine();
            foreach (var r in rows)
            {
                Console.WriteLine($"  [{r.StepId}] {r.StepLabel,-22} conf {r.Confidence:F2} {r.Origin,-8} status={r.Status} tools={r.ToolCallCount}");
                Console.WriteLine($"        id={r.Id} emittedAt={r.EmittedAt:O}");
            }
            return 0;
        }

        private static async Task<int> IngestAsync(string[] args)
        {
            int maxEvents = 16;
            int timeoutSeconds = 120;
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--max-events": maxEvents = int.Parse(args[++i], System.Globalization.CultureInfo.InvariantCulture); break;
                    case "--timeout":    timeoutSeconds = int.Parse(args[++i], System.Globalization.CultureInfo.InvariantCulture); break;
                    default: return Fail($"unknown argument: {args[i]}");
                }
            }

            Console.WriteLine($"adpc ingest (max-events={maxEvents}, timeout={timeoutSeconds}s)");
            Console.WriteLine();

            await using var ingest = DecisionIngestService.FromEnvironment();
            Console.WriteLine($"  consumer-group: {DecisionIngestService.DefaultConsumerGroup}");
            Console.WriteLine($"  topic:          {DecisionIngestService.DefaultTopic}");
            Console.WriteLine($"  cosmos:         adp/dw-state");
            Console.WriteLine();
            Console.WriteLine("listening for events...");

            var report = await ingest.RunAsync(maxEvents, TimeSpan.FromSeconds(timeoutSeconds));
            Console.WriteLine();
            Console.WriteLine($"OK: {report.EventsProcessed} event(s) processed, {report.EventsFailed} failed");
            foreach (var id in report.ProcessedDecisionIds) Console.WriteLine($"  + {id}");
            foreach (var err in report.Errors) Console.Error.WriteLine($"  ! {err}");
            return report.EventsFailed == 0 ? 0 : 1;
        }

        private static async Task<int> IndexAsync(string[] args)
        {
            string? knowledgeDir = null;
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--knowledge" or "-k": knowledgeDir = args[++i]; break;
                    default:
                        if (knowledgeDir is null && !args[i].StartsWith('-')) knowledgeDir = args[i];
                        else return Fail($"unknown argument: {args[i]}");
                        break;
                }
            }
            if (knowledgeDir is null) return Fail("index: --knowledge <dir> is required");
            if (!Directory.Exists(knowledgeDir)) return Fail($"knowledge directory not found: {knowledgeDir}");

            Console.WriteLine($"adpc index {knowledgeDir}");
            Console.WriteLine();

            try
            {
                var embed = EmbeddingService.FromEnvironment();
                var indexer = AzureSearchIndexer.FromEnvironment(embed);
                var report = await indexer.RebuildAsync(knowledgeDir);
                Console.WriteLine($"  index:       {report.IndexName} ({(report.IndexUpdated ? "updated" : "unchanged")})");
                Console.WriteLine($"  uploaded:    {report.DocsUploaded}");
                Console.WriteLine($"  failed:      {report.DocsFailed}");
                foreach (var err in report.Errors) Console.Error.WriteLine($"  ! {err}");
                Console.WriteLine();
                Console.WriteLine($"OK: index '{report.IndexName}' ready for `adpc execute --search-mode azure`");
                return report.DocsFailed == 0 ? 0 : 1;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"index failed: {ex.Message}");
                return 1;
            }
        }

        private static async Task<int> CompileAsync(string[] args)
        {
            string? inputPath = null;
            string? outputPath = null;
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--in" or "-i":  inputPath = args[++i]; break;
                    case "--out" or "-o": outputPath = args[++i]; break;
                    default:
                        if (inputPath is null && !args[i].StartsWith('-')) inputPath = args[i];
                        else return Fail($"unknown argument: {args[i]}");
                        break;
                }
            }

            if (inputPath is null) return Fail("compile: --in <package.json> is required");
            if (outputPath is null) return Fail("compile: --out <artifact.zip> is required");
            if (!File.Exists(inputPath)) return Fail($"input not found: {inputPath}");

            Console.WriteLine($"adpc compile {inputPath} -> {outputPath}");
            Console.WriteLine();

            var schemaPath = ResolveSchemaPath();
            var ctx = new CompileContext(inputPath, outputPath, schemaPath);

            try
            {
                await Stage1_SchemaValidate.RunAsync(ctx);
                await Stage2_SemanticValidate.RunAsync(ctx);
                await Stage3_PlanGenerate.RunAsync(ctx);
                await Stage4_SignAndRegister.RunAsync(ctx);
            }
            catch (CompileException ex)
            {
                Console.Error.WriteLine();
                Console.Error.WriteLine($"compile failed in {ex.Stage}: {ex.Message}");
                foreach (var detail in ex.Details) Console.Error.WriteLine($"  - {detail}");
                return 1;
            }

            Console.WriteLine();
            Console.WriteLine($"OK: artifact written to {outputPath}");
            return 0;
        }

        private static async Task<int> ExecuteAsync(string[] args)
        {
            string? artifactPath = null;
            string? subjectId = null;
            string? tracePath = null;
            string? claimPath = null;
            string? knowledgeDir = null;
            string adapterName = "stub";
            string searchMode = "local";
            bool toolsEnabled = false;
            bool publishDecisions = false;
            string? forceLowConfAgent = null;

            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--artifact" or "-a":   artifactPath = args[++i]; break;
                    case "--subject" or "-s":    subjectId = args[++i]; break;
                    case "--trace" or "-t":      tracePath = args[++i]; break;
                    case "--claim" or "-c":      claimPath = args[++i]; break;
                    case "--knowledge" or "-k":  knowledgeDir = args[++i]; break;
                    case "--adapter":            adapterName = args[++i]; break;
                    case "--search-mode":        searchMode = args[++i]; break;
                    case "--tools":              toolsEnabled = true; break;
                    case "--publish-decisions":  publishDecisions = true; break;
                    case "--demo-hitl-on":       forceLowConfAgent = args[++i]; break;
                    default:
                        if (artifactPath is null && !args[i].StartsWith('-')) artifactPath = args[i];
                        else return Fail($"unknown argument: {args[i]}");
                        break;
                }
            }

            if (artifactPath is null) return Fail("execute: --artifact <artifact.zip> is required");
            subjectId ??= $"subject-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
            tracePath ??= Path.ChangeExtension(artifactPath, ".trace.json");

            IAgentAdapter adapter;
            IContextRouter? router = null;
            IndustryAwareToolRegistry? toolRegistry = null;
            DecisionPublisher? publisher = null;
            try
            {
                adapter = adapterName.ToLowerInvariant() switch
                {
                    "stub" => new StubAdapter(new StubAdapterOptions { ForceLowConfidenceForAgentId = forceLowConfAgent }),
                    "foundry" => AgentAdapterFactory.FromEnvironment(),
                    _ => throw new ArgumentException($"unknown adapter '{adapterName}'. Valid: stub | foundry"),
                };

                if (knowledgeDir is not null || searchMode == "azure")
                {
                    var embed = EmbeddingService.FromEnvironment();
                    IContextSource foundryIq = searchMode.ToLowerInvariant() switch
                    {
                        "azure" => AzureSearchFoundryIQSource.FromEnvironment(embed),
                        "local" => new LocalFoundryIQSource(embed, knowledgeDir ?? throw new ArgumentException("--search-mode local requires --knowledge <dir>")),
                        _ => throw new ArgumentException($"unknown search-mode '{searchMode}'. Valid: local | azure"),
                    };
                    router = new ContextRouter([foundryIq, ResolveFabricIqSource(), new WorkIqSource()]);
                }

                if (toolsEnabled)
                {
                    // Track 4: industry-aware registry. The CLI loads both kits by default so a
                    // single `adpc execute` can drive any package; production cloud also uses
                    // the IndustryAwareToolRegistry shape but composed in DI.
                    var industries = new Dictionary<string, IToolRegistry>(StringComparer.OrdinalIgnoreCase)
                    {
                        [Adp.UseCases.Meridian.Tools.MeridianToolRegistry.Industry]     = Adp.UseCases.Meridian.Tools.MeridianToolRegistry.CreateDefault(),
                        [Adp.UseCases.Banking.Tools.BankingToolRegistry.Industry] = Adp.UseCases.Banking.Tools.BankingToolRegistry.CreateDefault(),
                    };
                    toolRegistry = new IndustryAwareToolRegistry(industries);
                }

                if (publishDecisions)
                {
                    publisher = DecisionPublisher.FromEnvironment();
                }
            }
            catch (Exception ex)
            {
                return Fail($"setup failed: {ex.Message}");
            }

            Console.WriteLine($"adpc execute {artifactPath}");
            Console.WriteLine($"  adapter:  {adapterName}");
            Console.WriteLine($"  subject:  {subjectId}");
            if (claimPath is not null)    Console.WriteLine($"  claim:    {claimPath}");
            if (router is not null)       Console.WriteLine($"  context:  Foundry IQ via {searchMode}{(knowledgeDir is not null ? $" ({knowledgeDir})" : "")}");
            if (toolRegistry is not null) Console.WriteLine($"  tools:    {toolRegistry.All.Count} registered ({string.Join(", ", toolRegistry.All.Select(t => t.Id))})");
            if (publisher is not null)    Console.WriteLine($"  decisions: publishing to Event Hubs {DecisionPublisher.DefaultTopic}");
            if (forceLowConfAgent is not null) Console.WriteLine($"  demo-hitl-on: {forceLowConfAgent}");
            Console.WriteLine();

            var executor = new PlanExecutor(adapter, router, toolRegistry, publisher);

            Trace trace;
            try
            {
                trace = await executor.ExecuteAsync(artifactPath, subjectId, claimPath);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"execute failed: {ex.Message}");
                return 1;
            }

            foreach (var step in trace.Steps)
            {
                var badge = step.Status switch
                {
                    "completed"           => "OK  ",
                    "needs-human-review"  => "HITL",
                    "failed"              => "FAIL",
                    _                     => ".... ",
                };
                var toolNote = step.ToolCalls is { Count: > 0 } tc ? $" · {tc.Count} tool call(s)" : "";
                Console.WriteLine($"  [{badge}] {step.StepId} · {step.Label,-22} · conf {step.Confidence:F2} · {step.Origin,-8} · {step.DurationMs}ms{toolNote}");
            }

            var traceJson = JsonSerializer.Serialize(trace, AgentPackageSerializer.Options);
            var traceDir = Path.GetDirectoryName(Path.GetFullPath(tracePath));
            if (!string.IsNullOrEmpty(traceDir)) Directory.CreateDirectory(traceDir);
            await File.WriteAllTextAsync(tracePath, traceJson);

            if (publisher is not null) await publisher.DisposeAsync();

            Console.WriteLine();
            Console.WriteLine($"OK: trace written to {tracePath}");
            return 0;
        }

        private static string ResolveSchemaPath()
        {
            var cwd = Directory.GetCurrentDirectory();
            var probe = cwd;
            for (int i = 0; i < 8; i++)
            {
                var candidate = Path.Combine(probe, "platform", "schemas", "agent-package.v1.schema.json");
                if (File.Exists(candidate)) return candidate;
                var parent = Directory.GetParent(probe)?.FullName;
                if (parent is null || parent == probe) break;
                probe = parent;
            }
            throw new FileNotFoundException("Could not locate platform/schemas/agent-package.v1.schema.json. Run adpc from the repo or pass --schema.");
        }

        private static void PrintUsage()
        {
            Console.WriteLine("adpc — agent package compiler & executor for adp-v1");
            Console.WriteLine();
            Console.WriteLine("Usage:");
            Console.WriteLine("  adpc compile --in <package.json> --out <artifact.zip>");
            Console.WriteLine("  adpc execute --artifact <artifact.zip> [options]");
            Console.WriteLine("  adpc index   --knowledge <dir>");
            Console.WriteLine();
            Console.WriteLine("execute options:");
            Console.WriteLine("  --subject <id>             Subject identifier (claim number, etc.)");
            Console.WriteLine("  --trace <out.json>         Where to write the trace JSON (default: <artifact>.trace.json)");
            Console.WriteLine("  --claim <path>             Path to a claim file (corpus or single claim) — passed to agents as context");
            Console.WriteLine("  --knowledge <dir>          (local search-mode) Knowledge directory for in-process retrieval");
            Console.WriteLine("  --search-mode local|azure  retrieval backend (default: local). Azure mode uses srch-adp-v1 — run `adpc index` once first");
            Console.WriteLine("  --adapter stub|foundry     stub (default) or foundry (real gpt-4o via Azure OpenAI)");
            Console.WriteLine("  --tools                    enable in-process tool registry (function calling)");
            Console.WriteLine("  --demo-hitl-on <agentId>   (stub only) force the named agent to low confidence to demo the HITL gate");
            Console.WriteLine();
            Console.WriteLine("Required environment:");
            Console.WriteLine("  AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY        for --adapter foundry and --knowledge");
            Console.WriteLine("  AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_API_KEY        for --search-mode azure and `index`");
        }

        private static int Fail(string msg)
        {
            Console.Error.WriteLine($"adpc: {msg}");
            return 2;
        }

        // Mirrors TracesApi/Program.cs DI selection so `adpc execute` and the cloud Function
        // agree on which FabricIQ implementation is active. See ADR-0011.
        private static IContextSource ResolveFabricIqSource()
        {
            var backend = (Environment.GetEnvironmentVariable("SEMANTIC_BACKEND") ?? "").Trim().ToLowerInvariant();
            var fabricConn = Environment.GetEnvironmentVariable("FABRIC_LAKEHOUSE_CONNECTION");
            var sqlConn    = Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTION");

            if (backend == "fabric")
            {
                if (string.IsNullOrEmpty(fabricConn)) throw new InvalidOperationException("SEMANTIC_BACKEND=fabric requires FABRIC_LAKEHOUSE_CONNECTION");
                return new FabricLakehouseSource(fabricConn);
            }
            if (backend == "sql")
            {
                if (string.IsNullOrEmpty(sqlConn)) throw new InvalidOperationException("SEMANTIC_BACKEND=sql requires AZURE_SQL_CONNECTION");
                return new SqlSemanticLayerSource(sqlConn);
            }
            return !string.IsNullOrEmpty(sqlConn) ? new SqlSemanticLayerSource(sqlConn) : new StubFabricIqSource();
        }
    }

    internal sealed class CompileContext(string inputPath, string outputPath, string schemaPath)
    {
        public string InputPath { get; } = inputPath;
        public string OutputPath { get; } = outputPath;
        public string SchemaPath { get; } = schemaPath;

        public string RawJson { get; set; } = "";
        public AgentPackage? Package { get; set; }

        public string StagingDir { get; } = Path.Combine(Path.GetTempPath(), $"adpc-{Guid.NewGuid():N}");
    }

    internal sealed class CompileException(string stage, string message, IReadOnlyList<string>? details = null)
        : Exception(message)
    {
        public string Stage { get; } = stage;
        public IReadOnlyList<string> Details { get; } = details ?? [];
    }
}
