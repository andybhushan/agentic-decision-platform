using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace Adp.ContextLayer;

// One-shot loader: reads the synthetic claim corpus + populates dim_policyholder / dim_vehicle / fact_claims
// in the v0 semantic-layer SQL database. Idempotent via MERGE statements.
//
// Invoked by `adpc semantic-load --corpus <path>`. See ADR-0011.
public sealed class SemanticLoader(string connectionString)
{
    public async Task<SemanticLoadReport> LoadAsync(string corpusPath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(corpusPath)) throw new FileNotFoundException(corpusPath);

        var ensure = new SqlSemanticLayerSource(connectionString);
        await ensure.EnsureSchemaAsync(cancellationToken);
        ensure.Dispose();

        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(corpusPath, cancellationToken));
        if (!doc.RootElement.TryGetProperty("claims", out var claimsArray) || claimsArray.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("corpus JSON has no 'claims' array");

        var policyholders = new Dictionary<string, (string firstName, string lastName, string policyNumber, string state, string city)>(StringComparer.Ordinal);
        var vehicles = new Dictionary<string, (string? plate, int year, string make, string model)>(StringComparer.Ordinal);
        var claims = new List<(string claimNumber, string policyholderId, string vin, DateTime incidentDate, string incidentType, string severityHint, string state, string channel, DateTime fnolReceivedAt)>();

        foreach (var c in claimsArray.EnumerateArray())
        {
            var claimNumber = c.GetProperty("claimNumber").GetString()!;
            var fnolAt = c.GetProperty("fnolReceivedAt").GetDateTime();
            var incidentDate = c.GetProperty("incidentDate").GetDateTime();
            var channel = c.GetProperty("channel").GetString()!;
            var ph = c.GetProperty("policyholder");
            var pol = c.GetProperty("policy");
            var veh = c.GetProperty("vehicle");
            var inc = c.GetProperty("incident");
            var exp = c.GetProperty("expected");

            var phId = ph.GetProperty("policyholderId").GetString()!;
            policyholders[phId] = (
                ph.GetProperty("firstName").GetString()!,
                ph.GetProperty("lastName").GetString()!,
                pol.GetProperty("policyNumber").GetString()!,
                ph.GetProperty("address").GetProperty("state").GetString()!,
                ph.GetProperty("address").GetProperty("city").GetString()!);

            var vin = veh.GetProperty("vin").GetString()!;
            vehicles[vin] = (
                veh.TryGetProperty("plate", out var p) ? p.GetString() : null,
                veh.GetProperty("year").GetInt32(),
                veh.GetProperty("make").GetString()!,
                veh.GetProperty("model").GetString()!);

            claims.Add((
                claimNumber,
                phId,
                vin,
                incidentDate,
                inc.GetProperty("incidentType").GetString()!,
                exp.GetProperty("severityHint").GetString()!,
                ph.GetProperty("address").GetProperty("state").GetString()!,
                channel,
                fnolAt));
        }

        using var sql = new SqlConnection(connectionString);
        await sql.OpenAsync(cancellationToken);

        int phInserted = await BulkMergeAsync(sql, "dim_policyholder", policyholders, cancellationToken);
        int vehInserted = await BulkMergeAsync(sql, "dim_vehicle", vehicles, cancellationToken);
        int claimsInserted = await MergeClaimsAsync(sql, claims, cancellationToken);

        return new SemanticLoadReport(policyholders.Count, vehicles.Count, claims.Count, phInserted, vehInserted, claimsInserted);
    }

    private static async Task<int> BulkMergeAsync(
        SqlConnection conn,
        string table,
        IDictionary<string, (string firstName, string lastName, string policyNumber, string state, string city)> phs,
        CancellationToken ct)
    {
        if (table != "dim_policyholder") return 0;
        const string upsert = @"
            MERGE dbo.dim_policyholder AS tgt
            USING (VALUES (@id, @first, @last, @policy, @state, @city)) AS src(policyholder_id, first_name, last_name, policy_number, state, city)
            ON tgt.policyholder_id = src.policyholder_id
            WHEN NOT MATCHED THEN INSERT (policyholder_id, first_name, last_name, policy_number, state, city)
                                  VALUES (src.policyholder_id, src.first_name, src.last_name, src.policy_number, src.state, src.city);";
        int n = 0;
        foreach (var (id, v) in phs)
        {
            using var cmd = new SqlCommand(upsert, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@first", v.firstName);
            cmd.Parameters.AddWithValue("@last", v.lastName);
            cmd.Parameters.AddWithValue("@policy", v.policyNumber);
            cmd.Parameters.AddWithValue("@state", v.state);
            cmd.Parameters.AddWithValue("@city", v.city);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        return n;
    }

    private static async Task<int> BulkMergeAsync(
        SqlConnection conn,
        string table,
        IDictionary<string, (string? plate, int year, string make, string model)> vehs,
        CancellationToken ct)
    {
        if (table != "dim_vehicle") return 0;
        const string upsert = @"
            MERGE dbo.dim_vehicle AS tgt
            USING (VALUES (@vin, @plate, @year, @make, @model)) AS src(vin, plate, year, make, model)
            ON tgt.vin = src.vin
            WHEN NOT MATCHED THEN INSERT (vin, plate, year, make, model)
                                  VALUES (src.vin, src.plate, src.year, src.make, src.model);";
        int n = 0;
        foreach (var (vin, v) in vehs)
        {
            using var cmd = new SqlCommand(upsert, conn);
            cmd.Parameters.AddWithValue("@vin", vin);
            cmd.Parameters.AddWithValue("@plate", (object?)v.plate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@year", v.year);
            cmd.Parameters.AddWithValue("@make", v.make);
            cmd.Parameters.AddWithValue("@model", v.model);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        return n;
    }

    private static async Task<int> MergeClaimsAsync(
        SqlConnection conn,
        IReadOnlyList<(string claimNumber, string policyholderId, string vin, DateTime incidentDate, string incidentType, string severityHint, string state, string channel, DateTime fnolReceivedAt)> claims,
        CancellationToken ct)
    {
        const string upsert = @"
            MERGE dbo.fact_claims AS tgt
            USING (VALUES (@cn, @ph, @vin, @id, @it, @sh, @st, @ch, @fn))
              AS src(claim_number, policyholder_id, vin, incident_date, incident_type, severity_hint, state, channel, fnol_received_at)
            ON tgt.claim_number = src.claim_number
            WHEN NOT MATCHED THEN INSERT (claim_number, policyholder_id, vin, incident_date, incident_type, severity_hint, state, channel, fnol_received_at)
                                  VALUES (src.claim_number, src.policyholder_id, src.vin, src.incident_date, src.incident_type, src.severity_hint, src.state, src.channel, src.fnol_received_at);";
        int n = 0;
        foreach (var c in claims)
        {
            using var cmd = new SqlCommand(upsert, conn);
            cmd.Parameters.AddWithValue("@cn", c.claimNumber);
            cmd.Parameters.AddWithValue("@ph", c.policyholderId);
            cmd.Parameters.AddWithValue("@vin", c.vin);
            cmd.Parameters.AddWithValue("@id", c.incidentDate);
            cmd.Parameters.AddWithValue("@it", c.incidentType);
            cmd.Parameters.AddWithValue("@sh", c.severityHint);
            cmd.Parameters.AddWithValue("@st", c.state);
            cmd.Parameters.AddWithValue("@ch", c.channel);
            cmd.Parameters.AddWithValue("@fn", c.fnolReceivedAt);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        return n;
    }
}

public sealed record SemanticLoadReport(
    int PolicyholdersInCorpus,
    int VehiclesInCorpus,
    int ClaimsInCorpus,
    int PolicyholdersInserted,
    int VehiclesInserted,
    int ClaimsInserted);
