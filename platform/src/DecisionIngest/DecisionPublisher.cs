using System.Text.Json;
using Azure.Messaging.EventHubs;
using Azure.Messaging.EventHubs.Producer;

namespace Adp.DecisionIngest;

// Publishes DecisionEvents to Event Hubs `adp-v1-decisions`. Used by PlanExecutor.
// Partition key: DigitalWorkerId — guarantees per-DW ordering at the consumer.
public sealed class DecisionPublisher : IDecisionSink
{
    public const string DefaultTopic = "adp-v1-decisions";
    private readonly EventHubProducerClient _producer;

    public DecisionPublisher(string connectionString, string topic = DefaultTopic)
    {
        _producer = new EventHubProducerClient(connectionString, topic);
    }

    public static DecisionPublisher FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_EVENTHUBS_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("DecisionPublisher requires AZURE_EVENTHUBS_CONNECTION.");
        return new DecisionPublisher(conn);
    }

    public async Task PublishAsync(DecisionEvent evt, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(evt);
        var data = new EventData(json)
        {
            ContentType = "application/json",
        };
        data.Properties["decisionId"] = evt.DecisionId;
        data.Properties["digitalWorkerId"] = evt.DigitalWorkerId;
        data.Properties["traceId"] = evt.TraceId;

        var options = new SendEventOptions { PartitionKey = evt.DigitalWorkerId };
        await _producer.SendAsync([data], options, cancellationToken);
    }

    public ValueTask DisposeAsync() => _producer.DisposeAsync();
}
