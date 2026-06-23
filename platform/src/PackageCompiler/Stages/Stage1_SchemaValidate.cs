using System.Text.Json.Nodes;
using Json.Schema;
using Adp.PackageModel;

namespace Adp.PackageCompiler.Stages;

internal static class Stage1_SchemaValidate
{
    public static async Task RunAsync(CompileContext ctx)
    {
        Console.WriteLine("[1/4] Schema validate");

        ctx.RawJson = await File.ReadAllTextAsync(ctx.InputPath);
        var instance = JsonNode.Parse(ctx.RawJson)
                       ?? throw new CompileException("schema-validate", "Input is empty or not valid JSON.");

        var schemaJson = await File.ReadAllTextAsync(ctx.SchemaPath);
        var schema = JsonSchema.FromText(schemaJson);
        var opts = new EvaluationOptions { OutputFormat = OutputFormat.List };
        var result = schema.Evaluate(instance, opts);

        if (!result.IsValid)
        {
            var details = new List<string>();
            CollectErrors(result, details);
            throw new CompileException("schema-validate", "package does not match agent-package.v1 schema.", details);
        }

        ctx.Package = AgentPackageSerializer.Load(ctx.InputPath);
        Console.WriteLine($"      ok: package id={ctx.Package.Package.Id} v{ctx.Package.Package.Version} (schemaVersion={ctx.Package.Package.SchemaVersion})");
    }

    private static void CollectErrors(EvaluationResults r, List<string> sink)
    {
        if (!r.IsValid && r.Errors is not null)
        {
            foreach (var (keyword, msg) in r.Errors)
                sink.Add($"{r.InstanceLocation} · {keyword}: {msg}");
        }
        foreach (var child in r.Details)
            CollectErrors(child, sink);
    }
}
