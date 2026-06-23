using System.Data;
using System.Globalization;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Adp.ContextLayer;

// FabricIQ stand-in for v0: Azure SQL-backed semantic layer.
// Per ADR-0011: same `IContextSource` contract that a future Fabric Lakehouse implementation will satisfy.
// The schema (dim_policyholder, dim_vehicle, fact_claims) and the intent → query mapping are stable;
// only the storage backend changes when we migrate.
public sealed class SqlSemanticLayerSource(string connectionString) : IContextSource, IDisposable
{
    public string SourceId => "FabricIQ";   // keep the conceptual layer name per ADR-0009

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Entity,
        ContextDimension.Historical,
    ];

    private readonly string _connStr = connectionString;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _schemaEnsured;

    public static SqlSemanticLayerSource FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("SqlSemanticLayerSource requires AZURE_SQL_CONNECTION.");
        return new SqlSemanticLayerSource(conn);
    }

    // SourceId-keyed named primitives. Mirrors FabricLakehouseSource so SEMANTIC_BACKEND swap stays
    // transparent — the same packages drive both backends because the primitive names match. Note:
    // aggregation primitives (Track 1) are NOT mirrored here — SqlSemanticLayerSource is the v0
    // fallback and is being deprecated; packages should target FabricIQ for rollups.
    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        if (request.SourceBindings is null) return [];
        if (!request.SourceBindings.TryGetValue(SourceId, out var primitives) || primitives is null || primitives.Count == 0)
            return [];

        var combined = new List<ContextFragment>();
        foreach (var primitive in primitives)
        {
            if (string.IsNullOrEmpty(primitive)) continue;
            var fragments = primitive switch
            {
                FabricLakehouseSource.PrimitivePolicyholderHistory => await PolicyholderHistoryAsync(request.SubjectId, topK, cancellationToken),
                FabricLakehouseSource.PrimitiveSimilarClaims       => await SimilarClaimsAsync(request.SubjectId, cancellationToken),
                FabricLakehouseSource.PrimitiveVehicleHistory      => await VehicleHistoryAsync(request.SubjectId, topK, cancellationToken),
                _ => Array.Empty<ContextFragment>() as IReadOnlyList<ContextFragment>,
            };
            combined.AddRange(fragments);
        }
        return combined;
    }

    private async Task<IReadOnlyList<ContextFragment>> VehicleHistoryAsync(string claimNumber, int topK, CancellationToken ct)
    {
        const string sql = @"
            DECLARE @vin NVARCHAR(32);
            SELECT @vin = vin FROM fact_claims WHERE claim_number = @claimNumber;

            SELECT TOP (@topK)
                c.claim_number, c.incident_date, c.incident_type, c.severity_hint, c.state,
                v.year, v.make, v.model, @vin AS vin
            FROM fact_claims c
            LEFT JOIN dim_vehicle v ON v.vin = c.vin
            WHERE c.vin = @vin AND c.claim_number <> @claimNumber
            ORDER BY c.incident_date DESC;";

        using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync(ct);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@topK", topK);
        cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
        using var reader = await cmd.ExecuteReaderAsync(ct);

        var rows = new List<(string ClaimNumber, DateTime IncidentDate, string IncidentType, string SeverityHint, string State, int Year, string Make, string Model, string Vin)>();
        while (await reader.ReadAsync(ct))
        {
            rows.Add((
                reader.GetString(0), reader.GetDateTime(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
                reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
                reader.IsDBNull(6) ? "?" : reader.GetString(6),
                reader.IsDBNull(7) ? "?" : reader.GetString(7),
                reader.IsDBNull(8) ? "?" : reader.GetString(8)));
        }

        if (rows.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "VEHICLE_HISTORY_EMPTY",
                Title: "Vehicle claim history",
                Content: "No prior claims on this VIN.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Prior claims for VIN {rows[0].Vin} ({rows[0].Year} {rows[0].Make} {rows[0].Model}):");
        foreach (var r in rows)
            sb.AppendLine(inv, $"- {r.ClaimNumber} on {r.IncidentDate:yyyy-MM-dd}: {r.IncidentType} ({r.SeverityHint}) in {r.State}");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"VEHICLE_HISTORY/{rows[0].Vin}",
            Title: $"Prior claims for {rows[0].Year} {rows[0].Make} {rows[0].Model}",
            Content: sb.ToString(),
            RelevanceScore: 0.97,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<IReadOnlyList<ContextFragment>> PolicyholderHistoryAsync(string claimNumber, int topK, CancellationToken ct)
    {
        const string sql = @"
            SELECT TOP (@topK)
                c.claim_number, c.policyholder_id, ph.first_name + ' ' + ph.last_name AS holder_name,
                c.incident_date, c.incident_type, c.severity_hint, c.state,
                (SELECT COUNT(*) FROM fact_claims c2 WHERE c2.policyholder_id = c.policyholder_id) AS holder_total_claims
            FROM fact_claims c
            JOIN dim_policyholder ph ON ph.policyholder_id = c.policyholder_id
            WHERE c.policyholder_id = (SELECT policyholder_id FROM fact_claims WHERE claim_number = @claimNumber)
              AND c.claim_number <> @claimNumber
            ORDER BY c.incident_date DESC;";

        using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync(ct);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@topK", topK);
        cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
        using var reader = await cmd.ExecuteReaderAsync(ct);

        var rows = new List<(string ClaimNumber, string PolicyholderId, string Name, DateTime IncidentDate, string IncidentType, string SeverityHint, string State, int TotalClaims)>();
        while (await reader.ReadAsync(ct))
        {
            rows.Add((
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetDateTime(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                reader.GetInt32(7)));
        }

        if (rows.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "POLICYHOLDER_HISTORY_EMPTY",
                Title: "Policyholder claim history",
                Content: "No prior claims found for this policyholder. First claim in our records.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Policyholder {rows[0].Name} ({rows[0].PolicyholderId}) — total {rows[0].TotalClaims} prior claims.");
        sb.AppendLine();
        foreach (var r in rows)
        {
            sb.AppendLine(inv, $"- {r.ClaimNumber} on {r.IncidentDate:yyyy-MM-dd}: {r.IncidentType} ({r.SeverityHint}) in {r.State}");
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"POLICYHOLDER_HISTORY/{rows[0].PolicyholderId}",
            Title: $"Prior claims for {rows[0].Name}",
            Content: sb.ToString(),
            RelevanceScore: 0.99,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<IReadOnlyList<ContextFragment>> SimilarClaimsAsync(string claimNumber, CancellationToken ct)
    {
        const string sql = @"
            DECLARE @incidentType NVARCHAR(64), @vin NVARCHAR(32), @state NVARCHAR(4);
            SELECT @incidentType = incident_type, @vin = vin, @state = state
              FROM fact_claims WHERE claim_number = @claimNumber;

            SELECT TOP 10
                c.claim_number, c.incident_date, c.severity_hint,
                v.make, v.model, v.year
            FROM fact_claims c
            LEFT JOIN dim_vehicle v ON v.vin = c.vin
            WHERE c.incident_type = @incidentType
              AND c.state = @state
              AND c.claim_number <> @claimNumber
            ORDER BY c.incident_date DESC;

            SELECT severity_hint, COUNT(*) AS cnt
              FROM fact_claims
             WHERE incident_type = @incidentType
               AND state = @state
               AND claim_number <> @claimNumber
             GROUP BY severity_hint;";

        using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync(ct);
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
        using var reader = await cmd.ExecuteReaderAsync(ct);

        // First result set: similar claims
        var examples = new List<string>();
        while (await reader.ReadAsync(ct))
        {
            examples.Add(string.Format(System.Globalization.CultureInfo.InvariantCulture,
                "- {0} on {1:yyyy-MM-dd}: severity={2} (vehicle {3} {4} {5})",
                reader.GetString(0),
                reader.GetDateTime(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? "?" : reader.GetString(3),
                reader.IsDBNull(4) ? "?" : reader.GetString(4),
                reader.IsDBNull(5) ? 0 : reader.GetInt32(5)));
        }

        // Second result set: severity distribution
        var distribution = new List<string>();
        if (await reader.NextResultAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                distribution.Add($"{reader.GetString(0)}: {reader.GetInt32(1)}");
            }
        }

        if (examples.Count == 0 && distribution.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "SIMILAR_CLAIMS_EMPTY",
                Title: "Similar prior claims (same incident-type + state)",
                Content: "No comparable prior claims found.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sb = new StringBuilder();
        sb.AppendLine("Similar prior claims (same incident type + state, last shown first):");
        foreach (var e in examples) sb.AppendLine(e);
        if (distribution.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Severity distribution across that population: " + string.Join(", ", distribution));
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"SIMILAR_CLAIMS/{claimNumber}",
            Title: "Similar prior claims",
            Content: sb.ToString(),
            RelevanceScore: 0.95,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    public async Task EnsureSchemaAsync(CancellationToken cancellationToken = default)
    {
        await _initLock.WaitAsync(cancellationToken);
        try
        {
            if (_schemaEnsured) return;

            const string ddl = @"
                IF OBJECT_ID('dbo.dim_policyholder','U') IS NULL
                BEGIN
                    CREATE TABLE dbo.dim_policyholder (
                        policyholder_id NVARCHAR(32) NOT NULL PRIMARY KEY,
                        first_name      NVARCHAR(64) NOT NULL,
                        last_name       NVARCHAR(64) NOT NULL,
                        policy_number   NVARCHAR(32) NOT NULL,
                        state           NVARCHAR(4)  NOT NULL,
                        city            NVARCHAR(64) NOT NULL
                    );
                END;

                IF OBJECT_ID('dbo.dim_vehicle','U') IS NULL
                BEGIN
                    CREATE TABLE dbo.dim_vehicle (
                        vin   NVARCHAR(32) NOT NULL PRIMARY KEY,
                        plate NVARCHAR(32) NULL,
                        year  INT          NOT NULL,
                        make  NVARCHAR(32) NOT NULL,
                        model NVARCHAR(64) NOT NULL
                    );
                END;

                IF OBJECT_ID('dbo.fact_claims','U') IS NULL
                BEGIN
                    CREATE TABLE dbo.fact_claims (
                        claim_number    NVARCHAR(32) NOT NULL PRIMARY KEY,
                        policyholder_id NVARCHAR(32) NOT NULL,
                        vin             NVARCHAR(32) NOT NULL,
                        incident_date   DATETIME2    NOT NULL,
                        incident_type   NVARCHAR(64) NOT NULL,
                        severity_hint   NVARCHAR(32) NOT NULL,
                        state           NVARCHAR(4)  NOT NULL,
                        channel         NVARCHAR(32) NOT NULL,
                        fnol_received_at DATETIME2   NOT NULL,
                        CONSTRAINT FK_fact_claims_policyholder FOREIGN KEY (policyholder_id) REFERENCES dbo.dim_policyholder(policyholder_id),
                        CONSTRAINT FK_fact_claims_vehicle FOREIGN KEY (vin) REFERENCES dbo.dim_vehicle(vin)
                    );
                    CREATE INDEX IX_fact_claims_incidentType_state ON dbo.fact_claims(incident_type, state);
                    CREATE INDEX IX_fact_claims_policyholder ON dbo.fact_claims(policyholder_id);
                END;";

            using var conn = new SqlConnection(_connStr);
            await conn.OpenAsync(cancellationToken);
            using var cmd = new SqlCommand(ddl, conn) { CommandTimeout = 60 };
            await cmd.ExecuteNonQueryAsync(cancellationToken);

            _schemaEnsured = true;
        }
        finally { _initLock.Release(); }
    }

    public void Dispose() => _initLock.Dispose();
}
