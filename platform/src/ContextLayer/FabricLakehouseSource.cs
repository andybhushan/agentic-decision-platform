using System.Globalization;
using System.Text;
using Azure.Core;
using Azure.Identity;
using Microsoft.Data.SqlClient;

namespace Adp.ContextLayer;

// v1 Fabric IQ implementation: reads from a Microsoft Fabric Lakehouse via its SQL analytics endpoint.
// Per ADR-0011: same `IContextSource` contract as `SqlSemanticLayerSource` — the migration is a DI swap.
//
// Two implementation differences vs the Azure SQL v0 source:
//  1. **AAD-only auth.** Lakehouse SQL endpoints reject SQL-auth credentials. We acquire a token via
//     `DefaultAzureCredential` for the SQL audience and attach it to the `SqlConnection.AccessToken`.
//  2. **Read-only endpoint.** No `EnsureSchemaAsync` — tables are created at Lakehouse provisioning time
//     (see `scripts/provision-fabric.ps1` + `scripts/load-fabric-lakehouse.ps1`). We also split each
//     intent into two round-trips instead of relying on `DECLARE @var; SELECT ... ; SELECT ...` batches
//     — Lakehouse SQL accepts those, but the two-query form is easier to reason about and identical
//     in latency at this scale.
//
// Activation: set `SEMANTIC_BACKEND=fabric` and `FABRIC_LAKEHOUSE_CONNECTION` on the Function app.
public sealed class FabricLakehouseSource(string connectionString, TokenCredential? credential = null) : IContextSource
{
    public string SourceId => "FabricIQ";

    public IReadOnlyList<ContextDimension> SupportedDimensions => [
        ContextDimension.Entity,
        ContextDimension.Historical,
    ];

    private readonly string _connStr = connectionString;
    private readonly TokenCredential _credential = credential ?? new DefaultAzureCredential();
    private static readonly TokenRequestContext _tokenContext = new(["https://database.windows.net/.default"]);

    public static FabricLakehouseSource FromEnvironment()
    {
        var conn = Environment.GetEnvironmentVariable("FABRIC_LAKEHOUSE_CONNECTION");
        if (string.IsNullOrEmpty(conn))
            throw new InvalidOperationException("FabricLakehouseSource requires FABRIC_LAKEHOUSE_CONNECTION.");
        return new FabricLakehouseSource(conn);
    }

    // Named primitives this source exposes. Packages select via contextBindings[].sourceBindings.
    // These names are P&C-schema-bound by design (the queries reference dim_policyholder / dim_vehicle /
    // fact_claims) but the dispatch is intent-name-agnostic — packages for any industry that happens to
    // share this schema can map their own intents onto these primitives without touching platform code.
    //
    // Row-level primitives (v0):
    public const string PrimitivePolicyholderHistory = "policyholder-history";
    public const string PrimitiveSimilarClaims       = "similar-claims";
    public const string PrimitiveVehicleHistory      = "vehicle-history";

    // Aggregated rollup primitives (Track 1 — v1 "Fabric IQ" semantic surface). These hit the same
    // Lakehouse SQL analytics endpoint but issue GROUP BY / aggregate queries to surface BUSINESS
    // signals (severity distribution, fraud-suggestive hour-of-day patterns, state loss-ratio,
    // incident-mix) rather than row-level reads. Per ADR-0014 this is honest "Fabric IQ" at the
    // Lakehouse default-semantic-model level; full Power BI semantic model with named DAX measures
    // is a v1.5 enhancement (would add caching + DAX), this layer is functionally equivalent for
    // the agent context use case.
    public const string PrimitiveSeverityDistribution     = "severity-distribution-by-state";
    public const string PrimitiveHourOfDayConcentration   = "hour-of-day-concentration";
    public const string PrimitiveStateLossRatio           = "state-loss-ratio";
    public const string PrimitiveIncidentTypeMix          = "incident-type-mix-by-state";

    // Generic schema-aware primitive (Track 5 — ADR-0016). Uses ContextRequest.SchemaContext to issue
    // a templated query against the package's declared tables. Industry-agnostic by design — banking,
    // healthcare, public-sector packages declare their own SchemaBinding and use this same primitive
    // name. Falls back to empty if no SchemaContext is provided.
    public const string PrimitiveEntityHistory            = "entity-history";

    public async Task<IReadOnlyList<ContextFragment>> QueryAsync(
        ContextRequest request, int topK, CancellationToken cancellationToken = default)
    {
        // v0.5 factor-out + Track 1: dispatch off the package's sourceBindings for this intent.
        // Each binding value is a list of named primitives → iterate, dispatch each, combine fragments.
        if (request.SourceBindings is null) return [];
        if (!request.SourceBindings.TryGetValue(SourceId, out var primitives) || primitives is null || primitives.Count == 0)
            return [];

        var combined = new List<ContextFragment>();
        foreach (var primitive in primitives)
        {
            if (string.IsNullOrEmpty(primitive)) continue;
            var fragments = primitive switch
            {
                // Row-level
                PrimitivePolicyholderHistory    => await PolicyholderHistoryAsync(request.SubjectId, topK, cancellationToken),
                PrimitiveSimilarClaims          => await SimilarClaimsAsync(request.SubjectId, cancellationToken),
                PrimitiveVehicleHistory         => await VehicleHistoryAsync(request.SubjectId, topK, cancellationToken),
                // Aggregated rollups (Track 1)
                PrimitiveSeverityDistribution   => await SeverityDistributionByStateAsync(request.SubjectId, cancellationToken),
                PrimitiveHourOfDayConcentration => await HourOfDayConcentrationAsync(request.SubjectId, cancellationToken),
                PrimitiveStateLossRatio         => await StateLossRatioAsync(request.SubjectId, cancellationToken),
                PrimitiveIncidentTypeMix        => await IncidentTypeMixByStateAsync(request.SubjectId, cancellationToken),
                // Schema-aware generic (Track 5)
                PrimitiveEntityHistory          => await EntityHistoryAsync(request, topK, cancellationToken),
                _ => Array.Empty<ContextFragment>() as IReadOnlyList<ContextFragment>,
            };
            combined.AddRange(fragments);
        }
        return combined;
    }

    private async Task<IReadOnlyList<ContextFragment>> SeverityDistributionByStateAsync(string claimNumber, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        // Resolve the subject's state, then aggregate severity counts across the corpus for that state.
        string? state;
        using (var cmd = new SqlCommand("SELECT state FROM fact_claims WHERE claim_number = @cn", conn))
        {
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            state = await cmd.ExecuteScalarAsync(ct) as string;
        }
        if (string.IsNullOrEmpty(state)) return [];

        const string sql = @"
            SELECT severity_hint, COUNT(*) AS cnt
            FROM fact_claims
            WHERE state = @state
            GROUP BY severity_hint
            ORDER BY cnt DESC;";

        var buckets = new List<(string Severity, int Count)>();
        int total = 0;
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@state", state);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var n = reader.GetInt32(1);
                buckets.Add((reader.GetString(0), n));
                total += n;
            }
        }
        if (buckets.Count == 0) return [];

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Severity distribution across {total} prior claims in {state}:");
        foreach (var (sev, n) in buckets)
        {
            var pct = total == 0 ? 0 : 100.0 * n / total;
            sb.AppendLine(inv, $"- {sev}: {n} ({pct:F1}%)");
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"SEVERITY_DIST/{state}",
            Title: $"Severity distribution for {state}",
            Content: sb.ToString(),
            RelevanceScore: 0.92,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Historical, ContextDimension.Entity])];
    }

    private async Task<IReadOnlyList<ContextFragment>> HourOfDayConcentrationAsync(string claimNumber, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        // Resolve the subject's fnol hour for comparison.
        int? subjectHour;
        using (var cmd = new SqlCommand("SELECT DATEPART(hour, fnol_received_at) FROM fact_claims WHERE claim_number = @cn", conn))
        {
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            var raw = await cmd.ExecuteScalarAsync(ct);
            subjectHour = raw == null || raw is DBNull ? null : Convert.ToInt32(raw, CultureInfo.InvariantCulture);
        }

        const string sql = @"
            SELECT DATEPART(hour, fnol_received_at) AS hr, COUNT(*) AS cnt
            FROM fact_claims
            GROUP BY DATEPART(hour, fnol_received_at)
            ORDER BY hr;";

        var hours = new int[24];
        int total = 0;
        using (var cmd = new SqlCommand(sql, conn))
        {
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var hr = reader.GetInt32(0);
                var n = reader.GetInt32(1);
                if (hr >= 0 && hr < 24) hours[hr] = n;
                total += n;
            }
        }
        if (total == 0) return [];

        // Identify off-hours band (00:00-05:59) — fraud-suggestive per PAC-FRD-001 timing rules.
        int offHours = 0;
        for (int h = 0; h < 6; h++) offHours += hours[h];
        var offPct = 100.0 * offHours / total;
        var subjectInOffWindow = subjectHour is >= 0 and < 6;

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Hour-of-day concentration across {total} prior claims:");
        sb.AppendLine(inv, $"- Off-hours window (00:00-05:59): {offHours} claims ({offPct:F1}% of population)");
        if (subjectHour.HasValue)
        {
            sb.AppendLine(inv, $"- This claim's FNOL received at hour {subjectHour.Value:D2}:00{(subjectInOffWindow ? " (in off-hours band)" : "")}");
        }
        // Top 3 hours
        var top = hours.Select((n, i) => (Hour: i, Count: n)).OrderByDescending(x => x.Count).Take(3);
        sb.Append("- Peak hours: ");
        sb.AppendLine(string.Join(", ", top.Select(t => $"{t.Hour:D2}:00 (n={t.Count})")));

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"HOUR_OF_DAY/{claimNumber}",
            Title: "Hour-of-day FNOL concentration",
            Content: sb.ToString(),
            RelevanceScore: subjectInOffWindow ? 0.95 : 0.85,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Historical, ContextDimension.Temporal])];
    }

    private async Task<IReadOnlyList<ContextFragment>> StateLossRatioAsync(string claimNumber, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        string? state;
        using (var cmd = new SqlCommand("SELECT state FROM fact_claims WHERE claim_number = @cn", conn))
        {
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            state = await cmd.ExecuteScalarAsync(ct) as string;
        }
        if (string.IsNullOrEmpty(state)) return [];

        const string sql = @"
            SELECT
              COUNT(*) AS total_claims,
              SUM(CASE WHEN severity_hint = 'total-loss-suspect' THEN 1 ELSE 0 END) AS total_loss_n,
              SUM(CASE WHEN severity_hint = 'high' THEN 1 ELSE 0 END) AS high_n
            FROM fact_claims
            WHERE state = @state;";

        int totalClaims = 0, totalLoss = 0, high = 0;
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@state", state);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                totalClaims = reader.GetInt32(0);
                totalLoss   = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
                high        = reader.IsDBNull(2) ? 0 : reader.GetInt32(2);
            }
        }
        if (totalClaims == 0) return [];

        var totalLossRate = 100.0 * totalLoss / totalClaims;
        var highOrAboveRate = 100.0 * (totalLoss + high) / totalClaims;

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"State-level loss ratios for {state} (n={totalClaims} prior claims):");
        sb.AppendLine(inv, $"- Total-loss-suspect rate: {totalLossRate:F1}% ({totalLoss} claims)");
        sb.AppendLine(inv, $"- High-or-above severity rate: {highOrAboveRate:F1}% ({totalLoss + high} claims)");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"STATE_LOSS_RATIO/{state}",
            Title: $"State loss-ratio rollup for {state}",
            Content: sb.ToString(),
            RelevanceScore: 0.88,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Historical, ContextDimension.Entity])];
    }

    private async Task<IReadOnlyList<ContextFragment>> IncidentTypeMixByStateAsync(string claimNumber, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        string? state;
        string? incidentType;
        using (var cmd = new SqlCommand("SELECT state, incident_type FROM fact_claims WHERE claim_number = @cn", conn))
        {
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return [];
            state = reader.GetString(0);
            incidentType = reader.GetString(1);
        }
        if (string.IsNullOrEmpty(state)) return [];

        const string sql = @"
            SELECT TOP 10 incident_type, COUNT(*) AS cnt
            FROM fact_claims
            WHERE state = @state
            GROUP BY incident_type
            ORDER BY cnt DESC;";

        var rows = new List<(string Type, int Count)>();
        int total = 0;
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@state", state);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var n = reader.GetInt32(1);
                rows.Add((reader.GetString(0), n));
                total += n;
            }
        }
        if (rows.Count == 0) return [];

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Incident-type mix in {state} (n={total} prior claims):");
        foreach (var (type, n) in rows)
        {
            var pct = 100.0 * n / total;
            var marker = string.Equals(type, incidentType, StringComparison.OrdinalIgnoreCase) ? "  <-- this claim" : "";
            sb.AppendLine(inv, $"- {type}: {n} ({pct:F1}%){marker}");
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"INCIDENT_MIX/{state}",
            Title: $"Incident-type mix for {state}",
            Content: sb.ToString(),
            RelevanceScore: 0.90,
            Origin: "GROUNDED",
            Dimensions: [ContextDimension.Historical, ContextDimension.Entity])];
    }

    private async Task<IReadOnlyList<ContextFragment>> VehicleHistoryAsync(string claimNumber, int topK, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        // Resolve VIN for this claim.
        string? vin;
        using (var cmd = new SqlCommand("SELECT vin FROM fact_claims WHERE claim_number = @cn;", conn))
        {
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            vin = await cmd.ExecuteScalarAsync(ct) as string;
        }

        if (string.IsNullOrEmpty(vin))
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "VEHICLE_HISTORY_EMPTY",
                Title: "Vehicle claim history",
                Content: "No vehicle (VIN) found for this claim.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        const string sql = @"
            SELECT TOP (@topK)
                c.claim_number, c.incident_date, c.incident_type, c.severity_hint, c.state,
                v.year, v.make, v.model
            FROM fact_claims c
            LEFT JOIN dim_vehicle v ON v.vin = c.vin
            WHERE c.vin = @vin AND c.claim_number <> @cn
            ORDER BY c.incident_date DESC;";

        var rows = new List<(string ClaimNumber, DateTime IncidentDate, string IncidentType, string SeverityHint, string State, int Year, string Make, string Model)>();
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@topK", topK);
            cmd.Parameters.AddWithValue("@vin", vin);
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((
                    reader.GetString(0), reader.GetDateTime(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
                    reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
                    reader.IsDBNull(6) ? "?" : reader.GetString(6),
                    reader.IsDBNull(7) ? "?" : reader.GetString(7)));
            }
        }

        if (rows.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: $"VEHICLE_HISTORY/{vin}",
                Title: "Vehicle claim history",
                Content: $"VIN {vin}: no prior claims on this vehicle.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Prior claims for VIN {vin} ({rows[0].Year} {rows[0].Make} {rows[0].Model}):");
        foreach (var r in rows)
            sb.AppendLine(inv, $"- {r.ClaimNumber} on {r.IncidentDate:yyyy-MM-dd}: {r.IncidentType} ({r.SeverityHint}) in {r.State}");

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"VEHICLE_HISTORY/{vin}",
            Title: $"Prior claims for {rows[0].Year} {rows[0].Make} {rows[0].Model}",
            Content: sb.ToString(),
            RelevanceScore: 0.97,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var token = await _credential.GetTokenAsync(_tokenContext, ct);
        var conn = new SqlConnection(_connStr) { AccessToken = token.Token };
        await conn.OpenAsync(ct);
        return conn;
    }

    // Track 5 / ADR-0016: schema-aware row-level primitive. The package's SchemaBinding.PrimaryEntity
    // names the tables + columns to query. Idempotent backward-compat: if no SchemaContext is provided,
    // returns empty (Meridian packages continue to bind to the P&C-named primitives like policyholder-history
    // instead; this primitive is for industries that opt into the schema-templated approach).
    //
    // Identifier safety: only [A-Za-z0-9_] allowed in table/column names from the binding (validated below).
    // Values are still parameterised. This prevents SQL injection from the schema declaration itself.
    private async Task<IReadOnlyList<ContextFragment>> EntityHistoryAsync(
        ContextRequest request, int topK, CancellationToken ct)
    {
        var schema = request.SchemaContext?.PrimaryEntity;
        if (schema is null) return [];

        // Validate identifiers — defence-in-depth even though SchemaBinding comes from signed packages.
        if (!IsSafeIdent(schema.FactTable) || !IsSafeIdent(schema.FactSubjectKey) ||
            !IsSafeIdent(schema.FactForeignKey) || !IsSafeIdent(schema.FactDateColumn) ||
            schema.FactDescColumns.Any(c => !IsSafeIdent(c)) ||
            (schema.DimTable is not null && !IsSafeIdent(schema.DimTable)) ||
            (schema.DimKeyColumn is not null && !IsSafeIdent(schema.DimKeyColumn)) ||
            (schema.DimDisplayColumns?.Any(c => !IsSafeIdent(c)) ?? false))
        {
            return [];
        }

        using var conn = await OpenAsync(ct);

        // 1) Resolve foreign-key (entity-id) for this subject.
        string? entityId;
        using (var cmd = new SqlCommand($"SELECT {schema.FactForeignKey} FROM {schema.FactTable} WHERE {schema.FactSubjectKey} = @subj;", conn))
        {
            cmd.Parameters.AddWithValue("@subj", request.SubjectId);
            entityId = await cmd.ExecuteScalarAsync(ct) as string;
        }
        if (string.IsNullOrEmpty(entityId))
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "ENTITY_HISTORY_EMPTY",
                Title: "Entity history",
                Content: $"No primary-entity row found for subject {request.SubjectId} in {schema.FactTable}.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        // 2) History for this entity, excluding current subject.
        var selectCols = string.Join(", ", new[] { schema.FactSubjectKey, schema.FactDateColumn }.Concat(schema.FactDescColumns).Select(c => "c." + c));
        string sql;
        if (schema.DimTable is not null && schema.DimKeyColumn is not null && schema.DimDisplayColumns is { Count: > 0 })
        {
            var dimCols = string.Join(", ", schema.DimDisplayColumns.Select(c => "d." + c));
            sql = $"SELECT TOP (@topK) {selectCols}, {dimCols} " +
                  $"FROM {schema.FactTable} c " +
                  $"JOIN {schema.DimTable} d ON d.{schema.DimKeyColumn} = c.{schema.FactForeignKey} " +
                  $"WHERE c.{schema.FactForeignKey} = @ent AND c.{schema.FactSubjectKey} <> @subj " +
                  $"ORDER BY c.{schema.FactDateColumn} DESC;";
        }
        else
        {
            sql = $"SELECT TOP (@topK) {selectCols} " +
                  $"FROM {schema.FactTable} c " +
                  $"WHERE c.{schema.FactForeignKey} = @ent AND c.{schema.FactSubjectKey} <> @subj " +
                  $"ORDER BY c.{schema.FactDateColumn} DESC;";
        }

        var rows = new List<IReadOnlyList<string>>();
        var headerCols = new List<string>(new[] { schema.FactSubjectKey, schema.FactDateColumn }.Concat(schema.FactDescColumns));
        if (schema.DimDisplayColumns is { Count: > 0 }) headerCols.AddRange(schema.DimDisplayColumns);

        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@topK", topK);
            cmd.Parameters.AddWithValue("@ent", entityId);
            cmd.Parameters.AddWithValue("@subj", request.SubjectId);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var row = new List<string>(reader.FieldCount);
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    row.Add(reader.IsDBNull(i) ? "" :
                        reader.GetFieldType(i) == typeof(DateTime)
                            ? reader.GetDateTime(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                            : Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture) ?? "");
                }
                rows.Add(row);
            }
        }

        if (rows.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: $"ENTITY_HISTORY/{entityId}",
                Title: "Entity history",
                Content: $"Entity {entityId}: no prior records in our store.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sbOut = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        var displayName = entityId;
        if (schema.DimDisplayColumns is { Count: > 0 })
        {
            // The dim-display columns are at the END of each row (after fact cols)
            var firstRow = rows[0];
            var dimStart = headerCols.Count - schema.DimDisplayColumns.Count;
            displayName = string.Join(' ', firstRow.Skip(dimStart).Take(schema.DimDisplayColumns.Count));
        }

        sbOut.AppendLine(inv, $"Prior records for entity {entityId} ({displayName}) — {rows.Count} found:");
        foreach (var r in rows)
        {
            // Show subject + date + first 2 desc cols as one-line summary.
            var subjectVal = r[0];
            var dateVal = r[1];
            var descSummary = string.Join(" / ", schema.FactDescColumns.Select((_, i) => r[2 + i]));
            sbOut.AppendLine(inv, $"- {subjectVal} on {dateVal}: {descSummary}");
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"ENTITY_HISTORY/{entityId}",
            Title: $"Prior records for {displayName}",
            Content: sbOut.ToString(),
            RelevanceScore: 0.96,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private static bool IsSafeIdent(string s)
        => !string.IsNullOrEmpty(s) && s.All(c => char.IsLetterOrDigit(c) || c == '_');

    private async Task<IReadOnlyList<ContextFragment>> PolicyholderHistoryAsync(string claimNumber, int topK, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        // Round 1: resolve the policyholder_id for this claim.
        const string lookup = @"SELECT policyholder_id FROM fact_claims WHERE claim_number = @claimNumber;";
        string? policyholderId;
        using (var cmd = new SqlCommand(lookup, conn))
        {
            cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
            var raw = await cmd.ExecuteScalarAsync(ct);
            policyholderId = raw as string;
        }

        if (string.IsNullOrEmpty(policyholderId))
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: "POLICYHOLDER_HISTORY_EMPTY",
                Title: "Policyholder claim history",
                Content: "No policyholder found for this claim number in the Lakehouse.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        // Round 2: claim history for that policyholder (excluding the current claim).
        const string sql = @"
            SELECT TOP (@topK)
                c.claim_number, c.policyholder_id, ph.first_name, ph.last_name,
                c.incident_date, c.incident_type, c.severity_hint, c.state
            FROM fact_claims c
            JOIN dim_policyholder ph ON ph.policyholder_id = c.policyholder_id
            WHERE c.policyholder_id = @ph
              AND c.claim_number <> @claimNumber
            ORDER BY c.incident_date DESC;";

        var rows = new List<(string ClaimNumber, string PolicyholderId, string FirstName, string LastName, DateTime IncidentDate, string IncidentType, string SeverityHint, string State)>();
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@topK", topK);
            cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
            cmd.Parameters.AddWithValue("@ph", policyholderId);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetDateTime(4),
                    reader.GetString(5),
                    reader.GetString(6),
                    reader.GetString(7)));
            }
        }

        // Round 3: total prior count (cheap aggregation).
        int totalPrior;
        using (var cmd = new SqlCommand("SELECT COUNT(*) FROM fact_claims WHERE policyholder_id = @ph AND claim_number <> @claimNumber;", conn))
        {
            cmd.Parameters.AddWithValue("@ph", policyholderId);
            cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
            totalPrior = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct) ?? 0, CultureInfo.InvariantCulture);
        }

        if (rows.Count == 0)
        {
            return [new ContextFragment(
                SourceId: SourceId,
                DocId: $"POLICYHOLDER_HISTORY/{policyholderId}",
                Title: "Policyholder claim history",
                Content: $"Policyholder {policyholderId} has no prior claims in our records. First claim.",
                RelevanceScore: 1.0,
                Origin: "GROUNDED",
                Dimensions: SupportedDimensions)];
        }

        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        var holderName = $"{rows[0].FirstName} {rows[0].LastName}";
        sb.AppendLine(inv, $"Policyholder {holderName} ({policyholderId}) — total {totalPrior} prior claims.");
        sb.AppendLine();
        foreach (var r in rows)
        {
            sb.AppendLine(inv, $"- {r.ClaimNumber} on {r.IncidentDate:yyyy-MM-dd}: {r.IncidentType} ({r.SeverityHint}) in {r.State}");
        }

        return [new ContextFragment(
            SourceId: SourceId,
            DocId: $"POLICYHOLDER_HISTORY/{policyholderId}",
            Title: $"Prior claims for {holderName}",
            Content: sb.ToString(),
            RelevanceScore: 0.99,
            Origin: "GROUNDED",
            Dimensions: SupportedDimensions)];
    }

    private async Task<IReadOnlyList<ContextFragment>> SimilarClaimsAsync(string claimNumber, CancellationToken ct)
    {
        using var conn = await OpenAsync(ct);

        // Round 1: discover the incident profile.
        string incidentType, state;
        using (var cmd = new SqlCommand(
            "SELECT incident_type, state FROM fact_claims WHERE claim_number = @claimNumber;", conn))
        {
            cmd.Parameters.AddWithValue("@claimNumber", claimNumber);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return [new ContextFragment(
                    SourceId: SourceId,
                    DocId: "SIMILAR_CLAIMS_EMPTY",
                    Title: "Similar prior claims (same incident-type + state)",
                    Content: "Claim not found in Lakehouse fact_claims.",
                    RelevanceScore: 1.0,
                    Origin: "GROUNDED",
                    Dimensions: SupportedDimensions)];
            }
            incidentType = reader.GetString(0);
            state = reader.GetString(1);
        }

        // Round 2: 10 most-recent similar claims.
        var examples = new List<string>();
        const string similar = @"
            SELECT TOP 10
                c.claim_number, c.incident_date, c.severity_hint, v.make, v.model, v.year
            FROM fact_claims c
            LEFT JOIN dim_vehicle v ON v.vin = c.vin
            WHERE c.incident_type = @it AND c.state = @st AND c.claim_number <> @cn
            ORDER BY c.incident_date DESC;";
        using (var cmd = new SqlCommand(similar, conn))
        {
            cmd.Parameters.AddWithValue("@it", incidentType);
            cmd.Parameters.AddWithValue("@st", state);
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            using var reader = await cmd.ExecuteReaderAsync(ct);
            var inv = CultureInfo.InvariantCulture;
            while (await reader.ReadAsync(ct))
            {
                examples.Add(string.Format(inv,
                    "- {0} on {1:yyyy-MM-dd}: severity={2} (vehicle {3} {4} {5})",
                    reader.GetString(0),
                    reader.GetDateTime(1),
                    reader.GetString(2),
                    reader.IsDBNull(3) ? "?" : reader.GetString(3),
                    reader.IsDBNull(4) ? "?" : reader.GetString(4),
                    reader.IsDBNull(5) ? 0 : reader.GetInt32(5)));
            }
        }

        // Round 3: severity distribution.
        var distribution = new List<string>();
        const string dist = @"
            SELECT severity_hint, COUNT(*) AS cnt
              FROM fact_claims
             WHERE incident_type = @it AND state = @st AND claim_number <> @cn
             GROUP BY severity_hint;";
        using (var cmd = new SqlCommand(dist, conn))
        {
            cmd.Parameters.AddWithValue("@it", incidentType);
            cmd.Parameters.AddWithValue("@st", state);
            cmd.Parameters.AddWithValue("@cn", claimNumber);
            using var reader = await cmd.ExecuteReaderAsync(ct);
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
        sb.AppendLine("Similar prior claims (same incident type + state, most recent first):");
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
}
