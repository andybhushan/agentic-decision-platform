using System.Text.RegularExpressions;
using Adp.PackageModel;

namespace Adp.Orchestration;

// Evaluates HITL gate triggers against a step's output.
//
// **v0 heuristic**: agents emit free-text output today, not structured JSON, so we keyword-match
// trigger expressions against the output text. This is deliberately narrow — it covers the trigger
// forms damage-handler.json actually declares (e.g., `claim.totalLossSuspect == true`,
// `assignment.shopTier == 'tier-1'`) and refuses to guess at anything else.
//
// **v1 plan**: agents emit a JSON sidecar (e.g., `<json>{...}</json>` block) which the orchestrator
// parses into a typed "claim state" dictionary; the evaluator runs a proper expression engine
// (JsonPath / Liquid / a tiny purpose-built DSL) against that state. Same `HitlGate.Trigger` syntax,
// same gate firing semantics — only the matching backend changes. The confidence-based path
// (`step.X.confidence < N`) is handled in `StepRunner.EvaluateStatus` separately and is unchanged.
public static class HitlGateEvaluator
{
    // Returns the first gate whose trigger matches the given step output, or null if none.
    // Confidence-based triggers are intentionally ignored here — StepRunner.EvaluateStatus handles those.
    public static HitlGate? EvaluateFieldGates(
        IReadOnlyList<HitlGate>? gates,
        string stepOutput,
        string stepCapabilityUnderscored)
    {
        if (gates is null || gates.Count == 0 || string.IsNullOrEmpty(stepOutput))
            return null;

        foreach (var gate in gates)
        {
            if (LooksLikeConfidenceTrigger(gate.Trigger))
                continue; // handled by EvaluateStatus

            // Step-scoped triggers: only fire on the step they reference.
            // Trigger like `step.damage_categorization.totalLossSuspect == true` requires we are
            // running the `damage_categorization` step.
            if (TryExtractStepScope(gate.Trigger, out var scopedStep) &&
                !string.Equals(scopedStep, stepCapabilityUnderscored, StringComparison.OrdinalIgnoreCase))
                continue;

            if (TriggerMatches(gate.Trigger, stepOutput))
                return gate;
        }
        return null;
    }

    private static bool LooksLikeConfidenceTrigger(string trigger)
        => trigger.Contains(".confidence", StringComparison.OrdinalIgnoreCase)
        && (trigger.Contains('<') || trigger.Contains('>'));

    // Extract `step.<name>` if present in trigger; otherwise null.
    private static bool TryExtractStepScope(string trigger, out string? stepName)
    {
        var m = Regex.Match(trigger, @"step\.(?<n>[a-z_]+)\.", RegexOptions.IgnoreCase);
        if (m.Success) { stepName = m.Groups["n"].Value; return true; }
        stepName = null;
        return false;
    }

    // Heart of the evaluator. v0 understands two trigger shapes:
    //   `<scope>.<field> == true`     → matches if output text contains the field name as a category
    //                                    keyword (kebab-case form), or contains the literal word "true"
    //                                    in proximity to the field name.
    //   `<scope>.<field> == '<value>'` → matches if output contains the value literally (with or without
    //                                    quotes), case-insensitive. v0 covers: shopTier == 'tier-1', etc.
    //
    // Anything else returns false (safe default — gate doesn't trip on a guess).
    private static bool TriggerMatches(string trigger, string output)
    {
        // Form 1: == true (boolean field assertion)
        var mBool = Regex.Match(trigger, @"\.(?<field>[A-Za-z_][A-Za-z0-9_]*)\s*==\s*true\b", RegexOptions.IgnoreCase);
        if (mBool.Success)
        {
            var field = mBool.Groups["field"].Value;
            // Match the kebab-case representation of the field name in output (e.g.,
            // totalLossSuspect → "total-loss-suspect"); agents in this codebase use that idiom.
            var kebab = CamelToKebab(field);
            return output.Contains(kebab, StringComparison.OrdinalIgnoreCase)
                || output.Contains(field, StringComparison.OrdinalIgnoreCase);
        }

        // Form 2: == 'literal' (string equality)
        var mStr = Regex.Match(trigger, @"\.[A-Za-z_][A-Za-z0-9_]*\s*==\s*'(?<v>[^']+)'");
        if (mStr.Success)
        {
            var v = mStr.Groups["v"].Value;
            return output.Contains(v, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private static string CamelToKebab(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        var sb = new System.Text.StringBuilder(s.Length + 4);
        for (int i = 0; i < s.Length; i++)
        {
            if (i > 0 && char.IsUpper(s[i])) sb.Append('-');
            sb.Append(char.ToLowerInvariant(s[i]));
        }
        return sb.ToString();
    }
}
