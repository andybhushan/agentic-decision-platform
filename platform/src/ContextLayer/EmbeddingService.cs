using System.ClientModel;
using Azure.AI.OpenAI;
using OpenAI.Embeddings;

namespace Adp.ContextLayer;

// Wraps Azure OpenAI Embeddings API for the platform.
// v0 deployment name: text-embedding-3-large @ dt-navigator-openai.
// Same endpoint + API key as the chat client (FoundryAdapter), so we read from the same env vars.
public sealed class EmbeddingService(EmbeddingServiceOptions options)
{
    private readonly AzureOpenAIClient _client = new(
        new Uri(options.Endpoint ?? throw new ArgumentException("AZURE_OPENAI_ENDPOINT not set")),
        new ApiKeyCredential(options.ApiKey ?? throw new ArgumentException("AZURE_OPENAI_API_KEY not set")));
    private readonly string _deployment = options.DeploymentName ?? "text-embedding-3-large";

    public static EmbeddingService FromEnvironment(string? deploymentName = null)
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("EmbeddingService requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.");
        return new EmbeddingService(new EmbeddingServiceOptions
        {
            Endpoint = endpoint,
            ApiKey = apiKey,
            DeploymentName = deploymentName,
        });
    }

    public async Task<float[]> EmbedAsync(string text, CancellationToken cancellationToken = default)
    {
        var client = _client.GetEmbeddingClient(_deployment);
        var result = await client.GenerateEmbeddingAsync(text, cancellationToken: cancellationToken);
        return result.Value.ToFloats().ToArray();
    }

    public async Task<float[][]> EmbedBatchAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken = default)
    {
        if (texts.Count == 0) return [];
        var client = _client.GetEmbeddingClient(_deployment);
        var result = await client.GenerateEmbeddingsAsync(texts, cancellationToken: cancellationToken);
        return [.. result.Value.Select(e => e.ToFloats().ToArray())];
    }

    public static double CosineSimilarity(ReadOnlySpan<float> a, ReadOnlySpan<float> b)
    {
        if (a.Length != b.Length) throw new ArgumentException("embedding lengths differ");
        double dot = 0, magA = 0, magB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        return dot / (Math.Sqrt(magA) * Math.Sqrt(magB) + 1e-9);
    }
}

public sealed class EmbeddingServiceOptions
{
    public string? Endpoint { get; init; }
    public string? ApiKey { get; init; }
    public string? DeploymentName { get; init; }
}
