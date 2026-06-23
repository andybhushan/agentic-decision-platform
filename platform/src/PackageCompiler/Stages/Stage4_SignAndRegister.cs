using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Adp.PackageModel;

namespace Adp.PackageCompiler.Stages;

internal static class Stage4_SignAndRegister
{
    public static async Task RunAsync(CompileContext ctx)
    {
        Console.WriteLine("[4/4] Sign and register");
        var pkg = ctx.Package!;

        // 1. Compute content hashes for every staged file
        var contentHashes = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var file in Directory.EnumerateFiles(ctx.StagingDir, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(ctx.StagingDir, file).Replace('\\', '/');
            contentHashes[rel] = await Sha256Async(file);
        }

        // 2. Write the signed manifest
        var manifest = new
        {
            schemaVersion = "manifest.v1",
            package = new { id = pkg.Package.Id, version = pkg.Package.Version, schemaVersion = pkg.Package.SchemaVersion },
            compiledAt = DateTimeOffset.UtcNow,
            compiler = "adpc/0.1.0",
            signedBy = "anand-track-stub",
            registry = new { kind = "agent-365-stub", uri = "agent-365://adp-v1", registered = false },
            contents = contentHashes,
            manifestSha256 = "",
        };
        var manifestJson = JsonSerializer.Serialize(manifest, AgentPackageSerializer.Options);
        var manifestSha = Sha256OfString(manifestJson);
        var signedManifest = manifestJson.Replace("\"manifestSha256\": \"\"", $"\"manifestSha256\": \"{manifestSha}\"");
        var manifestPath = Path.Combine(ctx.StagingDir, "manifest.json");
        await File.WriteAllTextAsync(manifestPath, signedManifest);

        // 3. Zip the staging dir to the output path
        if (File.Exists(ctx.OutputPath)) File.Delete(ctx.OutputPath);
        var outDir = Path.GetDirectoryName(Path.GetFullPath(ctx.OutputPath));
        if (!string.IsNullOrEmpty(outDir)) Directory.CreateDirectory(outDir);
        ZipFile.CreateFromDirectory(ctx.StagingDir, ctx.OutputPath, CompressionLevel.Optimal, includeBaseDirectory: false);

        // 4. Stub registration — write a registry record locally
        var regPath = Path.Combine(
            Path.GetDirectoryName(Path.GetFullPath(ctx.OutputPath)) ?? ".",
            $"{pkg.Package.Id}.registration.json");
        var registration = new
        {
            packageId = pkg.Package.Id,
            packageVersion = pkg.Package.Version,
            artifactPath = Path.GetFileName(ctx.OutputPath),
            artifactSha256 = await Sha256Async(ctx.OutputPath),
            manifestSha256 = manifestSha,
            registeredAt = DateTimeOffset.UtcNow,
            note = "v0 stub registration. Real Agent 365 hook on D9+.",
        };
        await File.WriteAllTextAsync(regPath, JsonSerializer.Serialize(registration, AgentPackageSerializer.Options));

        // 5. Clean up staging
        try { Directory.Delete(ctx.StagingDir, recursive: true); } catch { /* best-effort */ }

        Console.WriteLine($"      ok: manifest sha256 = {manifestSha[..16]}…");
        Console.WriteLine($"      ok: registration record at {regPath}");
    }

    private static async Task<string> Sha256Async(string path)
    {
        await using var stream = File.OpenRead(path);
        var bytes = await SHA256.HashDataAsync(stream);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Sha256OfString(string s)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
}
