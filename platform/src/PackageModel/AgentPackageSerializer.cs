using System.Text.Json;
using System.Text.Json.Serialization;

namespace Adp.PackageModel;

public static class AgentPackageSerializer
{
    public static JsonSerializerOptions Options { get; } = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static AgentPackage Load(string path)
    {
        using var stream = File.OpenRead(path);
        var pkg = JsonSerializer.Deserialize<AgentPackage>(stream, Options)
                  ?? throw new InvalidDataException($"Failed to deserialize package: {path}");
        return pkg;
    }

    public static string Serialize(AgentPackage pkg)
        => JsonSerializer.Serialize(pkg, Options);
}
