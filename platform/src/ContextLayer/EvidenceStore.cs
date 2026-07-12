using System.Text;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Adp.ContextLayer;

// Blob-backed evidence store: the images (and later documents) a subject's intake carries.
// Layout: evidence/{groupId}/{name} for the files themselves, plus an alias blob
// evidence/subjects/{subjectId} whose content is the groupId, so read-side surfaces can
// resolve evidence by subject without knowing upload-time group ids.
// Rides the existing AzureWebJobsStorage connection; container is created on first use.
public sealed class EvidenceStore(string connectionString)
{
    private readonly BlobContainerClient _container =
        new BlobServiceClient(connectionString).GetBlobContainerClient("evidence");
    private bool _ensured;

    public static EvidenceStore FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("EvidenceStore requires AzureWebJobsStorage.");
        return new EvidenceStore(conn);
    }

    private async Task EnsureAsync(CancellationToken ct)
    {
        if (_ensured) return;
        await _container.CreateIfNotExistsAsync(cancellationToken: ct);
        _ensured = true;
    }

    public async Task UploadAsync(string groupId, string name, byte[] bytes, string contentType, CancellationToken ct = default)
    {
        await EnsureAsync(ct);
        var blob = _container.GetBlobClient($"{groupId}/{name}");
        await blob.UploadAsync(new BinaryData(bytes), new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
        }, ct);
    }

    public async Task WriteSubjectAliasAsync(string subjectId, string groupId, CancellationToken ct = default)
    {
        await EnsureAsync(ct);
        var blob = _container.GetBlobClient($"subjects/{subjectId}");
        await blob.UploadAsync(new BinaryData(Encoding.UTF8.GetBytes(groupId)), overwrite: true, ct);
    }

    public async Task<string?> ResolveGroupAsync(string subjectId, CancellationToken ct = default)
    {
        await EnsureAsync(ct);
        var blob = _container.GetBlobClient($"subjects/{subjectId}");
        if (!await blob.ExistsAsync(ct)) return null;
        var content = await blob.DownloadContentAsync(ct);
        return content.Value.Content.ToString().Trim();
    }

    public async Task<IReadOnlyList<EvidenceFile>> ListAsync(string groupId, CancellationToken ct = default)
    {
        await EnsureAsync(ct);
        var files = new List<EvidenceFile>();
        await foreach (var item in _container.GetBlobsAsync(prefix: $"{groupId}/", cancellationToken: ct))
        {
            files.Add(new EvidenceFile(
                Name: item.Name[(groupId.Length + 1)..],
                ContentType: item.Properties.ContentType ?? "application/octet-stream",
                Size: item.Properties.ContentLength ?? 0));
        }
        return files;
    }

    public async Task<(byte[] Bytes, string ContentType)?> DownloadAsync(string groupId, string name, CancellationToken ct = default)
    {
        await EnsureAsync(ct);
        var blob = _container.GetBlobClient($"{groupId}/{name}");
        if (!await blob.ExistsAsync(ct)) return null;
        var content = await blob.DownloadContentAsync(ct);
        var props = await blob.GetPropertiesAsync(cancellationToken: ct);
        return (content.Value.Content.ToArray(), props.Value.ContentType ?? "application/octet-stream");
    }
}

public sealed record EvidenceFile(string Name, string ContentType, long Size);
