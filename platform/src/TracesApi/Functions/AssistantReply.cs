using System.Text.Json;

namespace Adp.TracesApi.Functions;

// Shared parsing for the conversational endpoints: the model is asked for a JSON object
// {"reply": "...", "followUps": ["..."]} so one call yields both the answer and the
// contextual next questions. Degrades to treating the whole content as the reply.
internal static class AssistantReply
{
    public static (string Reply, List<string> FollowUps) Parse(string content)
    {
        var followUps = new List<string>();
        if (string.IsNullOrWhiteSpace(content)) return ("", followUps);
        try
        {
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                var reply = doc.RootElement.TryGetProperty("reply", out var r) && r.ValueKind == JsonValueKind.String
                    ? r.GetString() ?? ""
                    : content;
                if (doc.RootElement.TryGetProperty("followUps", out var fu) && fu.ValueKind == JsonValueKind.Array)
                {
                    foreach (var q in fu.EnumerateArray())
                    {
                        var s = q.ValueKind == JsonValueKind.String ? q.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(s) && followUps.Count < 3) followUps.Add(s.Trim());
                    }
                }
                return (reply, followUps);
            }
        }
        catch (JsonException)
        {
            // Not JSON after all: the content is the reply.
        }
        return (content, followUps);
    }
}
