// Offline validator for the claim & policy input contract (no external deps).
// Validates each sample's `policy` against policy.schema.json and `claim` against claim.schema.json.
// Supports the JSON-Schema subset used by these contracts: type, required, properties,
// additionalProperties:false, $defs, $ref (in-file #/$defs/... and relative file refs),
// enum, const, pattern, minimum/maximum, minItems, format(date|date-time|uri-reference).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, "schemas");
const sampleDir = join(here, "samples");

const cache = new Map();
function loadSchema(file) {
  const p = resolve(schemaDir, file);
  if (!cache.has(p)) cache.set(p, JSON.parse(readFileSync(p, "utf8")));
  return cache.get(p);
}
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const dtRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function resolveRef(ref, root, file) {
  if (ref.startsWith("#/")) {
    return { schema: ref.slice(2).split("/").reduce((o, k) => o[k], root), root, file };
  }
  const [f, frag] = ref.split("#");
  const newRoot = loadSchema(f);
  const schema = frag ? frag.slice(1).split("/").filter(Boolean).reduce((o, k) => o[k], newRoot) : newRoot;
  return { schema, root: newRoot, file: f };
}

function validate(data, schema, root, file, path, errs) {
  if (schema.$ref) {
    const r = resolveRef(schema.$ref, root, file);
    return validate(data, r.schema, r.root, r.file, path, errs);
  }
  const t = schema.type;
  if (t === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) { errs.push(`${path}: expected object`); return; }
    for (const req of schema.required || []) if (!(req in data)) errs.push(`${path}.${req}: required`);
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) if (!(schema.properties && k in schema.properties)) errs.push(`${path}.${k}: not allowed (additionalProperties:false)`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in data) validate(data[k], sub, root, file, `${path}.${k}`, errs);
  } else if (t === "array") {
    if (!Array.isArray(data)) { errs.push(`${path}: expected array`); return; }
    if (schema.minItems != null && data.length < schema.minItems) errs.push(`${path}: minItems ${schema.minItems}`);
    if (schema.items) data.forEach((it, i) => validate(it, schema.items, root, file, `${path}[${i}]`, errs));
  } else if (t === "string") {
    if (typeof data !== "string") { errs.push(`${path}: expected string`); return; }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errs.push(`${path}: pattern ${schema.pattern} (got "${data}")`);
    if (schema.format === "date" && !dateRe.test(data)) errs.push(`${path}: bad date "${data}"`);
    if (schema.format === "date-time" && !dtRe.test(data)) errs.push(`${path}: bad date-time "${data}"`);
  } else if (t === "number" || t === "integer") {
    if (typeof data !== "number") { errs.push(`${path}: expected ${t}`); return; }
    if (t === "integer" && !Number.isInteger(data)) errs.push(`${path}: expected integer`);
    if (schema.minimum != null && data < schema.minimum) errs.push(`${path}: < minimum ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) errs.push(`${path}: > maximum ${schema.maximum}`);
  } else if (t === "boolean") {
    if (typeof data !== "boolean") errs.push(`${path}: expected boolean`);
  }
  if (schema.enum && !schema.enum.includes(data)) errs.push(`${path}: "${data}" not in enum`);
  if (schema.const !== undefined && data !== schema.const) errs.push(`${path}: must equal ${schema.const}`);
}

const policySchema = loadSchema("policy.schema.json");
const claimSchema = loadSchema("claim.schema.json");
let total = 0, failed = 0;
for (const f of readdirSync(sampleDir).filter((x) => x.endsWith(".sample.json"))) {
  const s = JSON.parse(readFileSync(join(sampleDir, f), "utf8"));
  const errs = [];
  validate(s.policy, policySchema, policySchema, "policy.schema.json", "policy", errs);
  validate(s.claim, claimSchema, claimSchema, "claim.schema.json", "claim", errs);
  total++;
  if (errs.length) { failed++; console.log(`FAIL ${f}`); errs.forEach((e) => console.log("   - " + e)); }
  else console.log(`PASS ${f}`);
}
console.log(`\n${total - failed}/${total} samples valid`);
process.exit(failed ? 1 : 0);
