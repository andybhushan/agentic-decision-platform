using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

namespace Adp.ContextLayer;

// GPT-4o vision over intake evidence: produces an objective, decision-relevant description
// of the uploaded images. Platform-generic: the prompt asks for observable facts about the
// evidence, not domain conclusions; the use case's agents draw the conclusions.
//
// Calls the Azure OpenAI REST API directly rather than Azure.AI.OpenAI: the SDK's chat
// path (PostfixSwapMaxTokens) is binary-incompatible with the OpenAI 2.10 assembly that
// Microsoft.Agents.AI.OpenAI resolves in this process.
public sealed class EvidenceVision(string endpoint, string apiKey, string deployment = "gpt-4o") : IDisposable
{
    private const string ApiVersion = "2024-10-21";
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(60) };

    public static EvidenceVision FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("EvidenceVision requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.");
        return new EvidenceVision(endpoint, apiKey);
    }

    public async Task<string> DescribeAsync(
        string subjectId,
        IReadOnlyList<(byte[] Bytes, string ContentType)> images,
        CancellationToken cancellationToken = default)
    {
        var userContent = new List<object>
        {
            new
            {
                type = "text",
                text = $"These images were submitted as evidence for subject '{subjectId}'. Describe objectively and " +
                       "concisely what they show, as input to a downstream assessment: what is depicted, visible damage or " +
                       "notable conditions (which parts or areas, apparent severity), readable text if any, and anything " +
                       "inconsistent or unclear. Do not invent details you cannot see. 6 sentences maximum.",
            },
        };
        foreach (var (bytes, contentType) in images.Take(6))
        {
            userContent.Add(new
            {
                type = "image_url",
                image_url = new { url = $"data:{contentType};base64,{Convert.ToBase64String(bytes)}" },
            });
        }

        var url = $"{endpoint.TrimEnd('/')}/openai/deployments/{deployment}/chat/completions?api-version={ApiVersion}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new
            {
                messages = new object[]
                {
                    new { role = "system", content = "You are an evidence intake assistant. Report only what is visibly present." },
                    new { role = "user", content = userContent },
                },
                temperature = 0.1,
                max_tokens = 400,
            }),
        };
        req.Headers.Add("api-key", apiKey);

        using var res = await _http.SendAsync(req, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"EvidenceVision: HTTP {(int)res.StatusCode} {body[..Math.Min(body.Length, 300)]}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
            ? choices[0].GetProperty("message").GetProperty("content").GetString() ?? ""
            : "";
    }

    public void Dispose() => _http.Dispose();
}
