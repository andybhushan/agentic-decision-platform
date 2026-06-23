#!/usr/bin/env node
// Synthetic P&C Auto claims generator for adp-v1 v0.
// Deterministic (seeded) so re-runs produce the same corpus.
// No external deps — runs with bare Node 20+.
//
// Shape is loosely Duck-Creek / Guidewire ClaimCenter-shaped based on public docs.
// Used as input to the FNOL Handler DW during v0 demo.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const count = Number(args.count ?? 25);
const seed = Number(args.seed ?? 4242);
const outPath = resolve(__dirname, String(args.out ?? `claims-${count}.json`));

function mulberry32(s) {
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p) => rng() < p;

const firstNames = ["Margaret", "James", "Sofia", "Liam", "Aisha", "Carlos", "Priya", "Jordan", "Mei", "Ethan", "Olivia", "Noah", "Zara", "Ravi", "Yuki", "Mateo", "Hannah", "Omar", "Chloe", "Diego"];
const lastNames = ["Ellison", "Cohen", "Patel", "Nguyen", "Garcia", "Smith", "Johnson", "Khan", "Romero", "Tanaka", "Brown", "Wilson", "Rodriguez", "Singh", "Martinez", "Ito", "Davies", "Hassan", "Lopez", "Reyes"];
const states = ["NY", "NJ", "CT", "PA", "MA", "CA", "FL", "TX", "IL", "GA", "OH", "WA", "VA", "NC"];
const cities = { NY: ["New York", "Buffalo", "Rochester"], NJ: ["Jersey City", "Newark"], CT: ["Hartford", "New Haven"], PA: ["Philadelphia", "Pittsburgh"], MA: ["Boston", "Worcester"], CA: ["Los Angeles", "San Diego", "San Jose"], FL: ["Miami", "Tampa", "Orlando"], TX: ["Dallas", "Houston", "Austin"], IL: ["Chicago", "Aurora"], GA: ["Atlanta", "Augusta"], OH: ["Columbus", "Cleveland"], WA: ["Seattle", "Spokane"], VA: ["Richmond", "Norfolk"], NC: ["Charlotte", "Raleigh"] };
const makes = ["Toyota", "Honda", "Ford", "Chevrolet", "Tesla", "BMW", "Audi", "Subaru", "Hyundai", "Volkswagen", "Lexus", "Mazda"];
const modelsByMake = {
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander"],
  Honda: ["Civic", "Accord", "CR-V", "Pilot"],
  Ford: ["F-150", "Escape", "Explorer", "Mustang"],
  Chevrolet: ["Equinox", "Silverado", "Malibu", "Tahoe"],
  Tesla: ["Model 3", "Model Y", "Model S"],
  BMW: ["3 Series", "5 Series", "X3", "X5"],
  Audi: ["A4", "Q5", "A6"],
  Subaru: ["Outback", "Forester", "Crosstrek"],
  Hyundai: ["Elantra", "Tucson", "Santa Fe"],
  Volkswagen: ["Jetta", "Tiguan", "Atlas"],
  Lexus: ["RX", "ES", "NX"],
  Mazda: ["CX-5", "Mazda3", "CX-30"],
};
const incidentTypes = ["rear-end-collision", "intersection-collision", "parking-lot-bump", "single-vehicle-rollover", "weather-related-damage", "hit-and-run-suspected", "comprehensive-theft", "vandalism", "animal-strike"];
const channels = ["mobile-app", "phone-csr", "agent-portal", "website"];
const policyTypes = ["personal-auto-standard", "personal-auto-premium", "personal-auto-rideshare"];
const coverageOptions = ["liability", "collision", "comprehensive", "uninsured-motorist", "medical-payments", "rental-reimbursement", "rideshare-endorsement"];

function vin() {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  return Array.from({ length: 17 }, () => chars[Math.floor(rng() * chars.length)]).join("");
}
function plate() {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${pick([...a])}${pick([...a])}${pick([...a])}-${between(100, 9999)}`;
}
function isoDate(daysBackMax = 30, hoursBack = 0) {
  const now = new Date("2026-05-26T12:00:00Z").getTime();
  const back = between(0, daysBackMax) * 86_400_000 + between(0, 23) * 3_600_000 + between(0, 59) * 60_000;
  return new Date(now - back - hoursBack * 3_600_000).toISOString();
}

function makeClaim(i) {
  const claimNumber = `CLM-2026-${String(10000 + i).padStart(5, "0")}`;
  const state = pick(states);
  const city = pick(cities[state]);
  const make = pick(makes);
  const model = pick(modelsByMake[make]);
  const year = between(2016, 2026);
  const fnolReceivedAt = isoDate(45);
  const incidentDate = new Date(new Date(fnolReceivedAt).getTime() - between(0, 5) * 86_400_000).toISOString();
  const policyTier = pick(policyTypes);
  const coverages = coverageOptions.filter(() => chance(policyTier.endsWith("premium") ? 0.75 : 0.55));
  if (!coverages.includes("liability")) coverages.unshift("liability");
  const fnolNarratives = {
    "rear-end-collision": "I was stopped at a red light when the car behind me hit my rear bumper. Both cars pulled over. The other driver gave me their info. Bumper has visible damage and trunk won't fully close.",
    "intersection-collision": "Another vehicle ran the stop sign at 5th and Maple and hit my driver-side door. Airbag deployed on that side. Police came and filed a report.",
    "parking-lot-bump": "Came back to my car at the grocery store and there's a dent and scrape on the passenger side. No note. Reviewing the store cameras with the manager.",
    "single-vehicle-rollover": "I hit black ice on the highway, lost control, and the car rolled into the median. Towed to the lot. Airbags deployed. I was wearing my seatbelt and have minor bruising.",
    "weather-related-damage": "Severe hailstorm last night. Hood, roof, and trunk all have dents. Windshield has a crack about 6 inches long.",
    "hit-and-run-suspected": "I was rear-ended at a stoplight and the other driver took off before I could get their plate. I have a partial plate and a dashcam clip.",
    "comprehensive-theft": "Car was stolen from my driveway between midnight and 6am. Filed police report this morning. Steering wheel was locked.",
    "vandalism": "Both side mirrors snapped off and there's spray paint along the driver side. Happened overnight in front of my house.",
    "animal-strike": "A deer ran into the road on Route 9. I couldn't stop in time. Significant front-end damage, possible radiator damage. No injuries.",
  };
  const incidentType = pick(incidentTypes);
  const fraudHints = chance(0.07);
  const lowConfidenceTriage = chance(0.12);
  const ambiguousCoverage = chance(0.1);

  return {
    claimNumber,
    fnolReceivedAt,
    incidentDate,
    channel: pick(channels),
    policyholder: {
      firstName: pick(firstNames),
      lastName: pick(lastNames),
      policyholderId: `PH-${between(100000, 999999)}`,
      contactPhone: `+1-${between(200, 999)}-${between(200, 999)}-${between(1000, 9999)}`,
      address: { city, state, postalCode: String(between(10000, 99999)) },
    },
    policy: {
      policyNumber: `POL-${between(100000, 999999)}`,
      policyType: policyTier,
      effectiveStart: "2025-08-01",
      effectiveEnd: "2026-08-01",
      coverages,
      deductibles: { collision: pick([500, 1000, 1500]), comprehensive: pick([250, 500, 1000]) },
    },
    vehicle: {
      vin: vin(),
      plate: plate(),
      year, make, model,
      vehicleId: `VH-${between(100000, 999999)}`,
    },
    incident: {
      incidentType,
      location: { city, state, intersection: `${pick(["5th", "Main", "Park", "Oak", "Elm", "1st", "Broadway"])} & ${pick(["Maple", "Pine", "Oak", "Cedar", "Birch", "Walnut"])}` },
      narrative: fnolNarratives[incidentType],
      injuries: chance(0.18),
      thirdPartyInvolved: !["comprehensive-theft", "vandalism", "weather-related-damage", "animal-strike", "single-vehicle-rollover"].includes(incidentType),
      policeReportFiled: chance(0.65),
      photos: between(0, 8),
    },
    flags: {
      potentialFraudIndicators: fraudHints,
      expectedLowConfidenceTriage: lowConfidenceTriage,
      ambiguousCoverage,
    },
    expected: {
      severityHint: pick(["low", "medium", "high", "total-loss-suspect"]),
      coverageDecisionHint: ambiguousCoverage ? "needs-human-review" : pick(["covered", "partially-covered", "denied"]),
    },
  };
}

const claims = Array.from({ length: count }, (_, i) => makeClaim(i));
const payload = {
  $note: "Synthetic claims for adp-v1 v0. Deterministic from seed.",
  generatedAt: new Date().toISOString(),
  seed,
  count,
  claims,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${count} claims to ${outPath}`);
