/**
 * Claims Demo Seeder — the single, reusable, production-quality claims pipeline.
 *
 * Goals (per demo requirements):
 *  1. Production-quality, internally CONSISTENT Claim data (no more "closed /
 *     100% / 0 minutes / new claim" contradictions).
 *  2. Every claim is driven through the real claims agents (when deployed) or a
 *     realistic mock, emitting telemetry via recordInteraction() so the
 *     Workforce / observability views show genuine agent activity.
 *  3. A clean, repeatable process: one wipe-and-reseed entry point plus an
 *     idempotent startup ensure.
 *
 * Only the Richard Hogan customer + policy data is preserved across a reseed —
 * he is the live FNOL demo subject. Every other persona/policy/claim is rebuilt
 * deterministically from the curated dataset below.
 */

import type {
  Claim,
  ClaimNote,
  ClaimStage,
  ClaimComplexity,
  ClientServiceTier,
  ClaimHandlingMode,
  ConfidenceLevel,
  CustomerPersona,
  DecisionType,
  IntakeChannel,
  Priority,
  RecommendedAction,
  NarrativeElement,
  EvidenceItem,
  AnomalySignal,
  PolicyContext,
} from '../types';
import type { Policy } from './policyService';
import { CosmosRepository } from './cosmosRepository';
import { recordInteraction } from './interactionService';
import { clearAllInteractions } from './cosmosService';
import { syncCustomerPersonaData } from './customerPersonaService';
import { syncAdjusterDemoData } from './adjusterDataService';
import { AgentService } from './agentService';
import { testDeployedAgent } from './foundryAgentDeployer';
import { AIProviderFactory } from './ai/aiProvider';
import type { ClaimConfidenceSignals } from './ai/aiProvider';
import type { Agent } from '../types';

const claimsRepo = new CosmosRepository<Claim>('claims');
const policiesRepo = new CosmosRepository<Policy>('policies');
const personasRepo = new CosmosRepository<CustomerPersona>('customer-personas');
const suiteRepo = new CosmosRepository<{ id: string }>('seeded-claim-suites');
const caseRepo = new CosmosRepository<{ id: string }>('seeded-claim-suite-cases');
const runRepo = new CosmosRepository<{ id: string }>('seeded-claim-suite-runs');
const evalRepo = new CosmosRepository<{ id: string }>('seeded-claim-suite-evals');
const fnolSessionsRepo = new CosmosRepository<{ id: string }>('fnol-sessions');

const agentService = new AgentService();

const RICHARD_PERSONA_ID = 'cust_richard_hogan';
const RICHARD_HOLDER_NAME = 'richard hogan';

// ── Deterministic RNG (so costs/tokens are stable per claim) ─────────────────

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(min: number, max: number, rnd: () => number): number {
  return Math.floor(min + rnd() * (max - min + 1));
}

// ── Claimant roster (tied to the real seeded personas + policies) ────────────

interface RosterEntry {
  personaId: string;
  name: string;
  tier: ClientServiceTier;
  email: string;
  phone: string;
  city: string;
  state: string;
  policyRef: string;
  coverageType: string;
  vehicle: string;
}

const ROSTER: Record<string, RosterEntry> = {
  maya: {
    personaId: 'cust_maya_thompson',
    name: 'Maya Thompson',
    tier: 'standard',
    email: 'maya.thompson@baneox-demo.com',
    phone: '+1-512-555-0173',
    city: 'Austin',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-MT01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Subaru Outback Touring XT (TQF-6204)',
  },
  carlos: {
    personaId: 'cust_carlos_ramirez',
    name: 'Carlos Ramirez',
    tier: 'priority',
    email: 'carlos.ramirez@baneox-demo.com',
    phone: '+1-602-555-0119',
    city: 'Phoenix',
    state: 'AZ',
    policyRef: 'POL-AUTO-US-2026-CR01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Ford F-150 Lariat (AZM-7318)',
  },
  danielle: {
    personaId: 'cust_danielle_brooks',
    name: 'Danielle Brooks',
    tier: 'standard',
    email: 'danielle.brooks@baneox-demo.com',
    phone: '+1-704-555-0156',
    city: 'Charlotte',
    state: 'NC',
    policyRef: 'POL-AUTO-US-2026-DB01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Acura MDX Advance (NCK-2745)',
  },
  renee: {
    personaId: 'cust_renee_walker',
    name: 'Renee Walker',
    tier: 'standard',
    email: 'renee.walker@baneox-demo.com',
    phone: '+1-303-555-0188',
    city: 'Denver',
    state: 'CO',
    policyRef: 'POL-AUTO-US-2026-RW01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Toyota 4Runner Limited (COH-8152)',
  },
  ethan: {
    personaId: 'cust_ethan_park',
    name: 'Ethan Park',
    tier: 'standard',
    email: 'ethan.park@baneox-demo.com',
    phone: '+1-614-555-0142',
    city: 'Columbus',
    state: 'OH',
    policyRef: 'POL-AUTO-US-2026-EP01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Genesis G70 3.3T (OHR-9046)',
  },
  priya: {
    personaId: 'cust_priya_nair',
    name: 'Priya Nair',
    tier: 'priority',
    email: 'priya.nair@baneox-demo.com',
    phone: '+1-408-555-0231',
    city: 'San Jose',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-PN01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 BMW 530i xDrive (CAJ-4412)',
  },
  james: {
    personaId: 'cust_james_okafor',
    name: 'James Okafor',
    tier: 'standard',
    email: 'james.okafor@baneox-demo.com',
    phone: '+1-713-555-0097',
    city: 'Houston',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-JO01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Chevrolet Silverado 1500 (TXH-3351)',
  },
  sofia: {
    personaId: 'cust_sofia_mendez',
    name: 'Sofia Mendez',
    tier: 'standard',
    email: 'sofia.mendez@baneox-demo.com',
    phone: '+1-210-555-0064',
    city: 'San Antonio',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-SM01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Honda CR-V Hybrid Sport (TXS-7720)',
  },
  derek: {
    personaId: 'cust_derek_huang',
    name: 'Derek Huang',
    tier: 'white_glove',
    email: 'derek.huang@baneox-demo.com',
    phone: '+1-206-555-0183',
    city: 'Seattle',
    state: 'WA',
    policyRef: 'POL-AUTO-US-2026-DH01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Tesla Model S Plaid (WAK-1199)',
  },
  aaliyah: {
    personaId: 'cust_aaliyah_johnson',
    name: 'Aaliyah Johnson',
    tier: 'standard',
    email: 'aaliyah.johnson@baneox-demo.com',
    phone: '+1-404-555-0345',
    city: 'Atlanta',
    state: 'GA',
    policyRef: 'POL-AUTO-US-2026-AJ01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Hyundai Tucson N Line (GAA-5568)',
  },
  marcus: {
    personaId: 'cust_marcus_bell',
    name: 'Marcus Bell',
    tier: 'standard',
    email: 'marcus.bell@baneox-demo.com',
    phone: '+1-312-555-0092',
    city: 'Chicago',
    state: 'IL',
    policyRef: 'POL-AUTO-US-2026-MB01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Jeep Grand Cherokee 4xe (ILC-8834)',
  },
  linda: {
    personaId: 'cust_linda_foster',
    name: 'Linda Foster',
    tier: 'priority',
    email: 'linda.foster@baneox-demo.com',
    phone: '+1-617-555-0217',
    city: 'Boston',
    state: 'MA',
    policyRef: 'POL-AUTO-US-2026-LF01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Volvo XC60 Recharge (MAB-2290)',
  },
  tyrone: {
    personaId: 'cust_tyrone_scott',
    name: 'Tyrone Scott',
    tier: 'standard',
    email: 'tyrone.scott@baneox-demo.com',
    phone: '+1-215-555-0138',
    city: 'Philadelphia',
    state: 'PA',
    policyRef: 'POL-AUTO-US-2026-TS01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Dodge Ram 1500 Bighorn (PAP-6643)',
  },
  natalie: {
    personaId: 'cust_natalie_chen',
    name: 'Natalie Chen',
    tier: 'white_glove',
    email: 'natalie.chen@baneox-demo.com',
    phone: '+1-310-555-0061',
    city: 'Los Angeles',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-NC01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Audi Q7 Premium Plus (CAL-9901)',
  },
  omar: {
    personaId: 'cust_omar_hassan',
    name: 'Omar Hassan',
    tier: 'standard',
    email: 'omar.hassan@baneox-demo.com',
    phone: '+1-480-555-0074',
    city: 'Scottsdale',
    state: 'AZ',
    policyRef: 'POL-AUTO-US-2026-OH01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Nissan Pathfinder SL (AZS-3315)',
  },
  brianna: {
    personaId: 'cust_brianna_white',
    name: 'Brianna White',
    tier: 'standard',
    email: 'brianna.white@baneox-demo.com',
    phone: '+1-702-555-0129',
    city: 'Las Vegas',
    state: 'NV',
    policyRef: 'POL-AUTO-US-2026-BW01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Kia Telluride SX (NVL-7742)',
  },
  rafael: {
    personaId: 'cust_rafael_santos',
    name: 'Rafael Santos',
    tier: 'priority',
    email: 'rafael.santos@baneox-demo.com',
    phone: '+1-305-555-0185',
    city: 'Miami',
    state: 'FL',
    policyRef: 'POL-AUTO-US-2026-RS01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Mercedes-Benz GLC 300 (FLM-1123)',
  },
  karen: {
    personaId: 'cust_karen_patel',
    name: 'Karen Patel',
    tier: 'standard',
    email: 'karen.patel@baneox-demo.com',
    phone: '+1-972-555-0057',
    city: 'Dallas',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-KP01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Toyota Camry XSE (TXD-4480)',
  },
  victor: {
    personaId: 'cust_victor_lam',
    name: 'Victor Lam',
    tier: 'standard',
    email: 'victor.lam@baneox-demo.com',
    phone: '+1-503-555-0096',
    city: 'Portland',
    state: 'OR',
    policyRef: 'POL-AUTO-US-2026-VL01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Mazda CX-5 Turbo (ORP-8867)',
  },
  jessica: {
    personaId: 'cust_jessica_kim',
    name: 'Jessica Kim',
    tier: 'standard',
    email: 'jessica.kim@baneox-demo.com',
    phone: '+1-612-555-0143',
    city: 'Minneapolis',
    state: 'MN',
    policyRef: 'POL-AUTO-US-2026-JK01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Lexus RX 350h F Sport (MNM-5512)',
  },
  patricia: {
    personaId: 'cust_patricia_o_connor',
    name: "Patricia O'Connor",
    tier: 'white_glove',
    email: 'patricia.oconnor@baneox-demo.com',
    phone: '+1-617-555-0291',
    city: 'Brookline',
    state: 'MA',
    policyRef: 'POL-AUTO-US-2026-PO01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Porsche Cayenne S (MAB-4417)',
  },
  grace: {
    personaId: 'cust_grace_sullivan',
    name: 'Grace Sullivan',
    tier: 'priority',
    email: 'grace.sullivan@baneox-demo.com',
    phone: '+1-916-555-0118',
    city: 'Sacramento',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-GS01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Lexus NX 350 F Sport (CAS-2261)',
  },
  trevor: {
    personaId: 'cust_trevor_lang',
    name: 'Trevor Lang',
    tier: 'standard',
    email: 'trevor.lang@baneox-demo.com',
    phone: '+1-615-555-0173',
    city: 'Nashville',
    state: 'TN',
    policyRef: 'POL-AUTO-US-2026-TL01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Ford Mustang GT (TNN-7034)',
  },
  olivia: {
    personaId: 'cust_olivia_bennett',
    name: 'Olivia Bennett',
    tier: 'priority',
    email: 'olivia.bennett@baneox-demo.com',
    phone: '+1-512-555-0264',
    city: 'Austin',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-OB01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 BMW X5 xDrive40i (TXA-9183)',
  },
  nathan: {
    personaId: 'cust_nathan_cole',
    name: 'Nathan Cole',
    tier: 'standard',
    email: 'nathan.cole@baneox-demo.com',
    phone: '+1-503-555-0142',
    city: 'Beaverton',
    state: 'OR',
    policyRef: 'POL-AUTO-US-2026-NC02',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Subaru Forester Limited (ORB-3357)',
  },
  andre: {
    personaId: 'cust_andre_coleman',
    name: 'Andre Coleman',
    tier: 'standard',
    email: 'andre.coleman@baneox-demo.com',
    phone: '+1-313-555-0097',
    city: 'Detroit',
    state: 'MI',
    policyRef: 'POL-AUTO-US-2026-AC01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Cadillac XT5 Premium Luxury (MID-6648)',
  },
  mei: {
    personaId: 'cust_mei_lin',
    name: 'Mei Lin',
    tier: 'priority',
    email: 'mei.lin@baneox-demo.com',
    phone: '+1-408-555-0319',
    city: 'Sunnyvale',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-ML01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Tesla Model Y Long Range (CAV-1180)',
  },
  jordan: {
    personaId: 'cust_jordan_pierce',
    name: 'Jordan Pierce',
    tier: 'standard',
    email: 'jordan.pierce@baneox-demo.com',
    phone: '+1-720-555-0136',
    city: 'Aurora',
    state: 'CO',
    policyRef: 'POL-AUTO-US-2026-JP01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Honda Accord Sport (COA-8829)',
  },
  hannah: {
    personaId: 'cust_hannah_whitaker',
    name: 'Hannah Whitaker',
    tier: 'white_glove',
    email: 'hannah.whitaker@baneox-demo.com',
    phone: '+1-203-555-0241',
    city: 'Greenwich',
    state: 'CT',
    policyRef: 'POL-AUTO-US-2026-HW01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Range Rover Velar P340 (CTG-5572)',
  },
  devon: {
    personaId: 'cust_devon_carter',
    name: 'Devon Carter',
    tier: 'standard',
    email: 'devon.carter@baneox-demo.com',
    phone: '+1-901-555-0188',
    city: 'Memphis',
    state: 'TN',
    policyRef: 'POL-AUTO-US-2026-DC01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Chevrolet Equinox LT (TNM-4406)',
  },
  isabella: {
    personaId: 'cust_isabella_romano',
    name: 'Isabella Romano',
    tier: 'standard',
    email: 'isabella.romano@baneox-demo.com',
    phone: '+1-216-555-0153',
    city: 'Cleveland',
    state: 'OH',
    policyRef: 'POL-AUTO-US-2026-IR01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Audi Q5 Premium Plus (OHC-7790)',
  },
  kevin: {
    personaId: 'cust_kevin_nguyen',
    name: 'Kevin Nguyen',
    tier: 'standard',
    email: 'kevin.nguyen@baneox-demo.com',
    phone: '+1-714-555-0126',
    city: 'Garden Grove',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-KN01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Toyota RAV4 XLE (CAG-3318)',
  },
  samuel: {
    personaId: 'cust_samuel_adeyemi',
    name: 'Samuel Adeyemi',
    tier: 'priority',
    email: 'samuel.adeyemi@baneox-demo.com',
    phone: '+1-301-555-0207',
    city: 'Silver Spring',
    state: 'MD',
    policyRef: 'POL-AUTO-US-2026-SA01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Genesis GV80 2.5T (MDS-6651)',
  },
  chloe: {
    personaId: 'cust_chloe_martin',
    name: 'Chloe Martin',
    tier: 'standard',
    email: 'chloe.martin@baneox-demo.com',
    phone: '+1-504-555-0179',
    city: 'New Orleans',
    state: 'LA',
    policyRef: 'POL-AUTO-US-2026-CM01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Mazda CX-30 Premium (LAN-2245)',
  },
  amara: {
    personaId: 'cust_amara_okeke',
    name: 'Amara Okeke',
    tier: 'standard',
    email: 'amara.okeke@baneox-demo.com',
    phone: '+1-832-555-0233',
    city: 'Sugar Land',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-AO01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Acura RDX A-Spec (TXS-8817)',
  },
  lucas: {
    personaId: 'cust_lucas_moreau',
    name: 'Lucas Moreau',
    tier: 'white_glove',
    email: 'lucas.moreau@baneox-demo.com',
    phone: '+1-305-555-0274',
    city: 'Coral Gables',
    state: 'FL',
    policyRef: 'POL-AUTO-US-2026-LM01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Mercedes-Benz E 450 4MATIC (FLC-1139)',
  },
  gabriela: {
    personaId: 'cust_gabriela_cruz',
    name: 'Gabriela Cruz',
    tier: 'standard',
    email: 'gabriela.cruz@baneox-demo.com',
    phone: '+1-915-555-0162',
    city: 'El Paso',
    state: 'TX',
    policyRef: 'POL-AUTO-US-2026-GC01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Nissan Rogue SV (TXE-4471)',
  },
  ryan: {
    personaId: 'cust_ryan_donovan',
    name: 'Ryan Donovan',
    tier: 'priority',
    email: 'ryan.donovan@baneox-demo.com',
    phone: '+1-857-555-0119',
    city: 'Quincy',
    state: 'MA',
    policyRef: 'POL-AUTO-US-2026-RD01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 BMW 330i xDrive (MAQ-7026)',
  },
  mia: {
    personaId: 'cust_mia_castellano',
    name: 'Mia Castellano',
    tier: 'standard',
    email: 'mia.castellano@baneox-demo.com',
    phone: '+1-702-555-0248',
    city: 'Henderson',
    state: 'NV',
    policyRef: 'POL-AUTO-US-2026-MC01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Hyundai Santa Fe Calligraphy (NVH-3390)',
  },
  elijah: {
    personaId: 'cust_elijah_washington',
    name: 'Elijah Washington',
    tier: 'priority',
    email: 'elijah.washington@baneox-demo.com',
    phone: '+1-404-555-0291',
    city: 'Marietta',
    state: 'GA',
    policyRef: 'POL-AUTO-US-2026-EW01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Volvo XC90 B6 Plus (GAM-5563)',
  },
  nina: {
    personaId: 'cust_nina_volkov',
    name: 'Nina Volkov',
    tier: 'white_glove',
    email: 'nina.volkov@baneox-demo.com',
    phone: '+1-206-555-0217',
    city: 'Bellevue',
    state: 'WA',
    policyRef: 'POL-AUTO-US-2026-NV01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2024 Mercedes-Benz GLE 450 4MATIC (WAB-1148)',
  },
  caleb: {
    personaId: 'cust_caleb_reed',
    name: 'Caleb Reed',
    tier: 'standard',
    email: 'caleb.reed@baneox-demo.com',
    phone: '+1-919-555-0184',
    city: 'Cary',
    state: 'NC',
    policyRef: 'POL-AUTO-US-2026-CR02',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2022 Volkswagen Tiguan SEL (NCC-6620)',
  },
  marco: {
    personaId: 'cust_marco_delgado',
    name: 'Marco Delgado',
    tier: 'priority',
    email: 'marco.delgado@baneox-demo.com',
    phone: '+1-619-555-0173',
    city: 'Chula Vista',
    state: 'CA',
    policyRef: 'POL-AUTO-US-2026-MD01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Infiniti QX60 Sensory (CAC-8841)',
  },
  zoe: {
    personaId: 'cust_zoe_hampton',
    name: 'Zoe Hampton',
    tier: 'standard',
    email: 'zoe.hampton@baneox-demo.com',
    phone: '+1-385-555-0156',
    city: 'Salt Lake City',
    state: 'UT',
    policyRef: 'POL-AUTO-US-2026-ZH01',
    coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
    vehicle: '2023 Kia Sorento SX Prestige (UTS-4407)',
  },
};

// ── Curated, internally-consistent claim scenarios ───────────────────────────

interface ClaimSpec {
  claimId: string;
  claimant: keyof typeof ROSTER;
  adjusterId: string;
  adjusterName: string;
  stage: ClaimStage;
  decisionType: DecisionType;
  scenarioTitle: string;
  description: string;
  incidentLocation: string;
  injury: boolean;
  fault: 'claimant' | 'third-party' | 'shared' | 'undetermined';
  estimate: number;
  confidence: ConfidenceLevel;
  complexity: ClaimComplexity;
  priority: Priority;
  daysAgoIncident: number;
  queueAge: string;
  intakeChannel: IntakeChannel;
  outcome?: 'settled' | 'denied' | 'totaled';
  fraud?: boolean;
  thirdParty?: string;
}

const CLAIM_SPECS: ClaimSpec[] = [
  {
    claimId: 'CLM-2026-AUTO-101',
    claimant: 'maya',
    adjusterId: 'adj_whitfield',
    adjusterName: 'James Whitfield',
    stage: 'closed',
    decisionType: 'Settlement Approval',
    scenarioTitle: 'Rear-end collision at signalized intersection',
    description:
      'Insured was stopped at a red light on N Lamar Blvd when a third-party vehicle failed to stop and struck the rear bumper at low speed. Clear third-party fault; no injuries reported. Repairs completed and claim settled.',
    incidentLocation: 'N Lamar Blvd & W 6th St, Austin, TX',
    injury: false,
    fault: 'third-party',
    estimate: 4820,
    confidence: 'high',
    complexity: 'low',
    priority: 'low',
    daysAgoIncident: 21,
    queueAge: '9 days',
    intakeChannel: 'Mobile App',
    outcome: 'settled',
    thirdParty: 'Brandon Cole',
  },
  {
    claimId: 'CLM-2026-AUTO-102',
    claimant: 'carlos',
    adjusterId: 'adj_ashworth',
    adjusterName: 'David Ashworth',
    stage: 'settlement',
    decisionType: 'Settlement Approval',
    scenarioTitle: 'Comprehensive hail damage to truck',
    description:
      'Severe supercell hailstorm caused extensive panel and windshield damage while the F-150 was parked at the insured\u2019s residence. Comprehensive peril, no third party. Appraisal complete; settlement figure ready for approval.',
    incidentLocation: 'Insured residence, Phoenix, AZ',
    injury: false,
    fault: 'undetermined',
    estimate: 11350,
    confidence: 'high',
    complexity: 'medium',
    priority: 'normal',
    daysAgoIncident: 6,
    queueAge: '2 days 4 hours',
    intakeChannel: 'Web Portal',
  },
  {
    claimId: 'CLM-2026-AUTO-103',
    claimant: 'danielle',
    adjusterId: 'adj_pemberton',
    adjusterName: 'Sarah Pemberton',
    stage: 'investigation',
    decisionType: 'Anomaly Review',
    scenarioTitle: 'Disputed-liability intersection side impact with injury',
    description:
      'Insured and a third party each report a green light at a four-way intersection collision. Soft-tissue neck injury reported by the insured. Liability is disputed and requires corroborating evidence before evaluation.',
    incidentLocation: 'Providence Rd & Fairview Rd, Charlotte, NC',
    injury: true,
    fault: 'shared',
    estimate: 18400,
    confidence: 'medium',
    complexity: 'high',
    priority: 'high',
    daysAgoIncident: 2,
    queueAge: '1 day 6 hours',
    intakeChannel: 'Phone',
    thirdParty: 'Kevin Alvarez',
  },
  {
    claimId: 'CLM-2026-AUTO-104',
    claimant: 'renee',
    adjusterId: 'adj_ashworth',
    adjusterName: 'David Ashworth',
    stage: 'evaluation',
    decisionType: 'Coverage Verification',
    scenarioTitle: 'Parking-lot hit-and-run',
    description:
      'Insured returned to find the 4Runner damaged along the driver-side doors in a grocery store parking lot. No third-party details available. Claim proceeding under uninsured-motorist / collision coverage; valuation underway.',
    incidentLocation: 'King Soopers parking lot, Denver, CO',
    injury: false,
    fault: 'undetermined',
    estimate: 6200,
    confidence: 'high',
    complexity: 'medium',
    priority: 'normal',
    daysAgoIncident: 1,
    queueAge: '20 hours',
    intakeChannel: 'Mobile App',
  },
  {
    claimId: 'CLM-2026-AUTO-105',
    claimant: 'ethan',
    adjusterId: 'adj_ashworth',
    adjusterName: 'David Ashworth',
    stage: 'intake',
    decisionType: 'Coverage Verification',
    scenarioTitle: 'Single-vehicle hydroplane into barrier',
    description:
      'During heavy rain on I-670 the insured hydroplaned and struck the center concrete barrier. Single-vehicle collision, no injuries. New claim awaiting coverage confirmation and FNOL completeness review.',
    incidentLocation: 'I-670 W near Neil Ave, Columbus, OH',
    injury: false,
    fault: 'claimant',
    estimate: 9750,
    confidence: 'medium',
    complexity: 'medium',
    priority: 'normal',
    daysAgoIncident: 0,
    queueAge: '3 hours',
    intakeChannel: 'Mobile App',
  },
  {
    claimId: 'CLM-2026-AUTO-106',
    claimant: 'grace',
    adjusterId: 'adj_blackwood',
    adjusterName: 'Emma Blackwood',
    stage: 'closed',
    decisionType: 'Settlement Approval',
    scenarioTitle: 'Windshield replacement (glass)',
    description:
      'A highway stone strike cracked the windshield beyond safe repair. Glass-only comprehensive claim, replaced same week with ADAS forward-camera recalibration and no deductible under the glass endorsement. Closed.',
    incidentLocation: 'CA-99 near Florin Rd, Sacramento, CA',
    injury: false,
    fault: 'undetermined',
    estimate: 1150,
    confidence: 'high',
    complexity: 'low',
    priority: 'low',
    daysAgoIncident: 34,
    queueAge: '5 days',
    intakeChannel: 'Web Portal',
    outcome: 'settled',
  },
  {
    claimId: 'CLM-2026-AUTO-107',
    claimant: 'trevor',
    adjusterId: 'adj_patel',
    adjusterName: 'Priya Patel',
    stage: 'evaluation',
    decisionType: 'Anomaly Review',
    scenarioTitle: 'Disputed-liability intersection collision with injury',
    description:
      'Both drivers claim right-of-way at a signalized intersection. The insured reports a soft-tissue neck injury and liability is disputed pending corroborating dashcam and witness evidence. Settlement value and comparative-fault split are outside automated thresholds.',
    incidentLocation: 'W End Ave & 21st Ave, Nashville, TN',
    injury: true,
    fault: 'shared',
    estimate: 21600,
    confidence: 'low',
    complexity: 'high',
    priority: 'urgent',
    daysAgoIncident: 4,
    queueAge: '2 days 11 hours',
    intakeChannel: 'Phone',
    fraud: false,
    thirdParty: 'Marcus Reed',
  },
  {
    claimId: 'CLM-2026-AUTO-108',
    claimant: 'olivia',
    adjusterId: 'adj_ashworth',
    adjusterName: 'David Ashworth',
    stage: 'investigation',
    decisionType: 'Policy Interpretation',
    scenarioTitle: 'Multi-vehicle freeway chain collision',
    description:
      'A sudden-stop chain-reaction collision on MoPac involved four vehicles. Insured is mid-chain. Apportioning liability across multiple parties and confirming rental-reimbursement limits requires policy interpretation before valuation.',
    incidentLocation: 'MoPac Expy (Loop 1) near Far West Blvd, Austin, TX',
    injury: false,
    fault: 'shared',
    estimate: 13900,
    confidence: 'medium',
    complexity: 'high',
    priority: 'high',
    daysAgoIncident: 3,
    queueAge: '1 day 2 hours',
    intakeChannel: 'Phone',
    thirdParty: 'Multiple third parties',
  },
];

// ── Generated portfolio (deterministic, still internally consistent) ─────────
//
// The 8 specs above are the hand-authored "hero" claims. To give the queue a
// realistic depth of work, we deterministically generate many more from a set
// of scenario archetypes spread across every persona. The Claim builder derives
// all dependent fields from each spec, so generated claims are as internally
// consistent as the hand-authored ones.

interface ScenarioArchetype {
  key: string;
  title: string;
  description: string;
  decisionType: DecisionType;
  fault: ClaimSpec['fault'];
  injury: boolean;
  fraud?: boolean;
  /** Inherent decision difficulty of this scenario. Drives confidence, priority, SLA and effort coherently. */
  complexity: ClaimComplexity;
  /** The only claim stages this scenario can plausibly occupy. Stage is picked
   *  deterministically from this list (hashed over the claimId) so every generated
   *  claim is in a stage that makes sense for its scenario — never a round-robin. */
  lifecycle: ClaimStage[];
  /** Comprehensive weather/theft/wildlife perils — not third-party liability. Routed to Ashworth (Repair vs Total Loss). */
  comprehensive?: boolean;
  estimateMin: number;
  estimateMax: number;
  locationFor: (city: string, state: string) => string;
  thirdParty?: string;
}

const ARCHETYPES: ScenarioArchetype[] = [
  {
    key: 'rear-end',
    title: 'Rear-end collision in slow traffic',
    description:
      'Insured was stopped in slow-moving traffic when a following vehicle failed to stop in time and struck the rear bumper. Third-party fault; damage moderate, no injuries.',
    decisionType: 'Settlement Approval',
    fault: 'third-party',
    injury: false,
    complexity: 'low',
    lifecycle: ['evaluation', 'settlement', 'closed'],
    estimateMin: 3200,
    estimateMax: 7400,
    locationFor: (c, s) => `Downtown arterial, ${c}, ${s}`,
    thirdParty: 'Brandon Cole',
  },
  {
    key: 'hail',
    title: 'Comprehensive hail damage',
    description:
      'A severe hailstorm caused widespread panel and glass damage while the vehicle was parked. Comprehensive peril, no third party involved.',
    decisionType: 'Settlement Approval',
    fault: 'undetermined',
    injury: false,
    comprehensive: true,
    complexity: 'medium',
    lifecycle: ['investigation', 'evaluation', 'settlement', 'closed'],
    estimateMin: 7800,
    estimateMax: 14600,
    locationFor: (c, s) => `Insured residence, ${c}, ${s}`,
  },
  {
    key: 'disputed-injury',
    title: 'Disputed-liability intersection collision with injury',
    description:
      'Both drivers claim right-of-way at an intersection collision. The insured reports a soft-tissue injury. Liability disputed pending corroborating evidence.',
    decisionType: 'Anomaly Review',
    fault: 'shared',
    injury: true,
    complexity: 'high',
    lifecycle: ['investigation', 'evaluation'],
    estimateMin: 12400,
    estimateMax: 22800,
    locationFor: (c, s) => `Signalized intersection, ${c}, ${s}`,
    thirdParty: 'Kevin Alvarez',
  },
  {
    key: 'hit-and-run',
    title: 'Parking-lot hit-and-run',
    description:
      'Insured returned to find the vehicle damaged with no third-party details left. Treated as an uninsured-motorist / collision event pending valuation.',
    decisionType: 'Coverage Verification',
    fault: 'undetermined',
    injury: false,
    complexity: 'medium',
    lifecycle: ['intake', 'investigation', 'evaluation', 'closed'],
    estimateMin: 3800,
    estimateMax: 8200,
    locationFor: (c, s) => `Retail parking lot, ${c}, ${s}`,
  },
  {
    key: 'hydroplane',
    title: 'Single-vehicle hydroplane into barrier',
    description:
      'During heavy rain the insured hydroplaned and struck a barrier. Single-vehicle collision, no other parties, no injuries.',
    decisionType: 'Coverage Verification',
    fault: 'claimant',
    injury: false,
    complexity: 'medium',
    lifecycle: ['intake', 'evaluation', 'settlement'],
    estimateMin: 6900,
    estimateMax: 12600,
    locationFor: (c, s) => `Interstate near ${c}, ${s}`,
  },
  {
    key: 'glass',
    title: 'Windshield replacement (glass)',
    description:
      'A highway stone strike cracked the windshield beyond safe repair. Glass-only comprehensive claim under the full-glass endorsement; replacement requires ADAS forward-camera recalibration.',
    decisionType: 'Settlement Approval',
    fault: 'undetermined',
    injury: false,
    complexity: 'low',
    lifecycle: ['evaluation', 'settlement', 'closed'],
    estimateMin: 750,
    estimateMax: 1600,
    locationFor: (c, s) => `Highway near ${c}, ${s}`,
  },
  {
    key: 'staged',
    title: 'Suspected staged collision',
    description:
      'Reported sideswipe shows damage inconsistent with the described impact, a witness number linked to a prior claim, and delayed notification. Referred to SIU; reserve held.',
    decisionType: 'Fraud Investigation',
    fault: 'undetermined',
    injury: false,
    fraud: true,
    complexity: 'high',
    lifecycle: ['investigation', 'evaluation', 'closed'],
    estimateMin: 0,
    estimateMax: 0,
    locationFor: (c, s) => `Outer ring road, ${c}, ${s}`,
    thirdParty: 'Marcus Reed',
  },
  {
    key: 'chain',
    title: 'Multi-vehicle chain collision',
    description:
      'A sudden-stop chain-reaction collision involved several vehicles with the insured mid-chain. Apportioning liability and confirming rental limits needs policy interpretation.',
    decisionType: 'Policy Interpretation',
    fault: 'shared',
    injury: false,
    complexity: 'high',
    lifecycle: ['investigation', 'evaluation'],
    estimateMin: 9800,
    estimateMax: 17800,
    locationFor: (c, s) => `Expressway near ${c}, ${s}`,
    thirdParty: 'Multiple third parties',
  },
  {
    key: 'theft',
    title: 'Vehicle break-in and theft of contents',
    description:
      'The vehicle was broken into overnight; window smashed and personal items taken. Comprehensive theft/vandalism peril pending coverage confirmation on contents.',
    decisionType: 'Coverage Verification',
    fault: 'undetermined',
    injury: false,
    complexity: 'medium',
    lifecycle: ['intake', 'investigation', 'evaluation'],
    // Not marked comprehensive — broken window / damage assessment routes to Whitfield (Motor Damage).
    estimateMin: 2600,
    estimateMax: 9400,
    locationFor: (c, s) => `Residential street, ${c}, ${s}`,
  },
  {
    key: 'animal',
    title: 'Animal strike (deer) on rural road',
    description:
      'The insured struck a deer that entered the roadway at dusk, damaging the front end. Comprehensive peril, no third party, no injuries.',
    decisionType: 'Settlement Approval',
    fault: 'undetermined',
    injury: false,
    comprehensive: true,
    complexity: 'medium',
    lifecycle: ['investigation', 'evaluation', 'settlement', 'closed'],
    estimateMin: 4200,
    estimateMax: 9600,
    locationFor: (c, s) => `Rural route outside ${c}, ${s}`,
  },
  {
    key: 'backing',
    title: 'Low-speed backing collision',
    description:
      'Insured reversed into a fixed object / parked car at low speed in a car park. Insured at fault, minor damage, no injuries.',
    decisionType: 'Settlement Approval',
    fault: 'claimant',
    injury: false,
    complexity: 'low',
    lifecycle: ['evaluation', 'settlement', 'closed'],
    estimateMin: 1800,
    estimateMax: 4800,
    locationFor: (c, s) => `Car park, ${c}, ${s}`,
  },
  {
    key: 'flood',
    title: 'Flash-flood water damage',
    description:
      'Rising water from a flash flood reached the vehicle while parked, causing suspected drivetrain and electrical damage. Coverage and total-loss threshold need interpretation.',
    decisionType: 'Policy Interpretation',
    fault: 'undetermined',
    injury: false,
    comprehensive: true,
    complexity: 'high',
    lifecycle: ['intake', 'investigation', 'evaluation'],
    estimateMin: 8800,
    estimateMax: 24800,
    locationFor: (c, s) => `Low-lying street, ${c}, ${s}`,
  },
];

// Deterministically pick a stage for a generated claim from the scenario's own
// coherent lifecycle. The pick is hashed over the claimId so the portfolio shows
// variety, but every claim is always in a stage that makes sense for its scenario
// (a glass claim is never "under investigation"; a disputed-injury claim is never
// sitting at "intake"). No global round-robin.
function pickStage(arch: ScenarioArchetype, claimId: string): ClaimStage {
  const lifecycle = arch.lifecycle.length > 0 ? arch.lifecycle : (['evaluation'] as ClaimStage[]);
  const idx = hashSeed(`stage-${claimId}`) % lifecycle.length;
  return lifecycle[idx];
}

// Intake channel derived from the scenario, deterministically per claim — not a
// rotating index. Injury / disputed-liability / multi-party losses come in by
// phone (a person talks it through); quick first-party perils come in digitally.
function deriveChannel(arch: ScenarioArchetype, claimId: string): IntakeChannel {
  if (arch.injury || arch.fault === 'shared') return 'Phone';
  if (arch.fraud) return 'Web Portal';
  const digital: IntakeChannel[] = ['Mobile App', 'Web Portal'];
  return digital[hashSeed(`chan-${claimId}`) % digital.length];
}

const ADJUSTERS_BY_ROLE = {
  fraud: { id: 'adj_patel', name: 'Priya Patel' },
  injury: { id: 'adj_pemberton', name: 'Sarah Pemberton' },
  highValue: { id: 'adj_chen', name: 'Michael Chen' },
  fastTrack: { id: 'adj_blackwood', name: 'Emma Blackwood' },
  standard: { id: 'adj_ashworth', name: 'David Ashworth' },
  motor: { id: 'adj_whitfield', name: 'James Whitfield' },
};

function chooseAdjuster(
  arch: ScenarioArchetype,
  estimate: number,
  seqIndex: number = 0,
  clientTier: ClientServiceTier = 'standard',
): { id: string; name: string } {
  // Fraud → always Patel (the only fraud specialist). No rotation to injury/prestige adjusters.
  if (arch.fraud) return ADJUSTERS_BY_ROLE.fraud;

  // Injury claims → Pemberton (Motor Injury specialist).
  if (arch.injury) return ADJUSTERS_BY_ROLE.injury;

  // Very high value → Chen (Lead, Major Loss / Prestige / Fleet).
  if (estimate >= 15000) return ADJUSTERS_BY_ROLE.highValue;

  // Glass and very low value → Blackwood (Fast-Track, Low-Value).
  // Premier (priority) and above clients are routed to Whitfield instead — they
  // should not receive a fast-track experience regardless of claim value.
  if (estimate > 0 && estimate < 3000) {
    if (clientTier === 'priority' || clientTier === 'white_glove' || clientTier === 'signature') {
      return ADJUSTERS_BY_ROLE.motor;
    }
    return ADJUSTERS_BY_ROLE.fastTrack;
  }

  // Comprehensive/weather/theft/wildlife perils → Ashworth (Repair vs Total Loss).
  // These are first-party claims with no third-party liability component.
  if (arch.comprehensive) return ADJUSTERS_BY_ROLE.standard;

  // Multi-vehicle / shared-fault liability → Ashworth (Multi-Vehicle Impact, Liability Review).
  if (arch.fault === 'shared') return ADJUSTERS_BY_ROLE.standard;

  // Default: clean third-party fault motor damage → Whitfield (Motor Damage, Third-Party Liability).
  return ADJUSTERS_BY_ROLE.motor;
}

// Confidence is a pure function of (complexity, stage, fraud) so it is identical
// everywhere it is read and always defensible for the scenario:
//  • fraud is inherently uncertain until cleared → low
//  • a claim at settlement/closed has had its decision essentially made → high
//  • low-complexity losses (glass, backing, clean rear-end) are clear-cut → high
//  • medium-complexity claims firm up once valuation is reached → high at evaluation, else medium
//  • high-complexity claims (disputed liability, multi-party, flood) stay medium until resolved
function deriveConfidence(complexity: ClaimComplexity, stage: ClaimStage, fraud: boolean): ConfidenceLevel {
  if (fraud) return 'low';
  if (stage === 'closed' || stage === 'settlement') return 'high';
  if (complexity === 'low') return 'high';
  if (complexity === 'medium') return stage === 'evaluation' ? 'high' : 'medium';
  return 'medium';
}

function derivePriority(complexity: ClaimComplexity, stage: ClaimStage, arch: ScenarioArchetype, estimate: number): Priority {
  if (arch.fraud) return 'urgent';
  if (stage === 'closed') return 'low';
  if (arch.injury) return 'high';
  if (complexity === 'high') return 'high';
  if (estimate >= 16000) return 'high';
  if (complexity === 'low') return 'low';
  return 'normal';
}

// "Time in queue" — how long the claim has been waiting at its current stage.
// Deterministic per claim (seeded by claimId) and broadly stage-appropriate:
// new claims are hours old, closed claims are days old.
function deriveStageTiming(stage: ClaimStage, claimId: string): { daysAgo: number; queueAge: string } {
  const n = hashSeed(`timing-${claimId}`);
  switch (stage) {
    case 'intake':
      return { daysAgo: 0, queueAge: `${2 + (n % 9)} hours` };
    case 'investigation':
      return { daysAgo: 2 + (n % 3), queueAge: `1 day ${3 + (n % 9)} hours` };
    case 'evaluation':
      return { daysAgo: 1 + (n % 4), queueAge: `${14 + (n % 9)} hours` };
    case 'settlement':
      return { daysAgo: 4 + (n % 4), queueAge: `2 days ${1 + (n % 8)} hours` };
    case 'closed':
    default:
      return { daysAgo: 18 + (n % 16), queueAge: `${5 + (n % 7)} days` };
  }
}

function generatePortfolio(): ClaimSpec[] {
  // Each generated claim gets a DISTINCT claimant that is not already used by a
  // hero spec, so no customer name ever repeats across the visible portfolio.
  const heroUsed = new Set<string>(CLAIM_SPECS.map((s) => s.claimant as string));
  const availableKeys = (Object.keys(ROSTER) as Array<keyof typeof ROSTER>)
    .filter((k) => !heroUsed.has(k as string));
  const specs: ClaimSpec[] = [];
  // Cap at the number of unique personas left so we never reuse a name.
  const target = Math.min(34, availableKeys.length); // total portfolio ~= 8 hero + 34 = 42 claims
  let seq = 109;

  for (let i = 0; i < target; i += 1) {
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    const claimantKey = availableKeys[i];
    const roster = ROSTER[claimantKey];
    const claimId = `CLM-2026-AUTO-${seq}`;
    // Stage is chosen from the scenario's own coherent lifecycle (deterministic
    // per claim) — never a global round-robin. Fraud lifecycles already exclude
    // intake/settlement, so a held-reserve claim is never shown as "settled".
    const stage = pickStage(arch, claimId);
    const complexity = arch.complexity;
    const rnd = mulberry32(hashSeed(`${arch.key}-${claimantKey}-${i}`));

    const rawEstimate = arch.estimateMax > 0
      ? randomInt(arch.estimateMin, arch.estimateMax, rnd)
      : 0;
    // Open fraud claims carry $0 reserve until cleared.
    const estimate = arch.fraud && stage !== 'closed' ? 0 : rawEstimate;
    const adjuster = chooseAdjuster(arch, estimate || arch.estimateMax, i, roster.tier);
    const { daysAgo, queueAge } = deriveStageTiming(stage, claimId);

    specs.push({
      claimId,
      claimant: claimantKey,
      adjusterId: adjuster.id,
      adjusterName: adjuster.name,
      stage,
      decisionType: stage === 'intake' ? 'Coverage Verification' : arch.decisionType,
      scenarioTitle: arch.title,
      description: arch.description,
      incidentLocation: arch.locationFor(roster.city, roster.state),
      injury: arch.injury,
      fault: arch.fault,
      estimate,
      confidence: deriveConfidence(complexity, stage, Boolean(arch.fraud)),
      complexity,
      priority: derivePriority(complexity, stage, arch, estimate || arch.estimateMax),
      daysAgoIncident: daysAgo,
      queueAge,
      intakeChannel: deriveChannel(arch, claimId),
      outcome: stage === 'closed' ? (arch.fraud ? 'denied' : 'settled') : undefined,
      fraud: arch.fraud,
      thirdParty: arch.thirdParty,
    });
    seq += 1;
  }

  return specs;
}

CLAIM_SPECS.push(...generatePortfolio());

// ── Demo-critical overrides ──────────────────────────────────────────────────
// Andre Coleman's glass claim is the primary walkthrough claim for Emma Blackwood's
// queue. It must rank #1. Fix its queue age to a long value so it always wins the
// queue-age tiebreaker when tier and AI confidence are equal with any other claim.
const andreSpec = CLAIM_SPECS.find((s) => s.claimant === 'andre');
if (andreSpec) {
  andreSpec.queueAge = '2 days 6 hours';
  andreSpec.daysAgoIncident = 3;
  andreSpec.estimate = 1138; // locked to match the NAGN repair quote document
}

// A realistic Principal-adjuster queue shouldn't be dominated by SIU fraud
// referrals (which bypass senior redirect entirely, per SOP-001). Re-theme one
// generated "staged collision" fraud claim as a complex, non-fraud settlement
// that genuinely needs senior sign-off — this exercises the delegated-authority
// redirect path (as opposed to the specialist-referral block) in the demo queue.
const meiSpec = CLAIM_SPECS.find((s) => s.claimId === 'CLM-2026-AUTO-127');
if (meiSpec) {
  meiSpec.decisionType = 'Settlement Approval';
  meiSpec.scenarioTitle = 'High-value multi-vehicle collision, settlement over authority';
  meiSpec.description =
    'A sudden-stop chain collision on Highway 101 left the insured\'s vehicle a likely total loss. Liability is clear (rear vehicle at fault) but the settlement valuation significantly exceeds the adjuster\'s delegated authority and requires senior sign-off before payment can be issued.';
  meiSpec.incidentLocation = 'US-101 near Sunnyvale, CA';
  meiSpec.injury = false;
  meiSpec.fault = 'third-party';
  meiSpec.estimate = 38200;
  meiSpec.confidence = 'medium';
  meiSpec.complexity = 'high';
  meiSpec.priority = 'urgent';
  meiSpec.stage = 'evaluation';
  meiSpec.fraud = false;
  meiSpec.thirdParty = 'Dominic Reyes';
  meiSpec.intakeChannel = 'Phone';
  meiSpec.outcome = undefined;
  meiSpec.adjusterId = 'adj_patel';
  meiSpec.adjusterName = 'Priya Patel';
}

// ── Consistency helpers ──────────────────────────────────────────────────────

function handlingModeForTier(tier: ClientServiceTier): ClaimHandlingMode {
  if (tier === 'signature' || tier === 'white_glove') return 'human';
  if (tier === 'priority') return 'ai_oversight';
  return 'ai';
}

// The economic nature of a claim. Every dependent narrative field (recommended
// action, blocker, last agent action, coverage clauses) is derived from this so
// a first-party glass or comprehensive claim is never described in third-party
// "liability" terms, and vice-versa.
type ClaimClass = 'fraud' | 'injury' | 'glass' | 'comprehensive' | 'liability' | 'collision';

function deriveClaimClass(spec: ClaimSpec): ClaimClass {
  if (spec.fraud) return 'fraud';
  if (spec.injury) return 'injury';
  const t = spec.scenarioTitle.toLowerCase();
  if (t.includes('glass') || t.includes('windshield')) return 'glass';
  // First-party, non-collision perils — no third-party liability dimension.
  if (
    t.includes('hail') ||
    t.includes('animal') || t.includes('deer') ||
    t.includes('flood') || t.includes('water') ||
    t.includes('theft') || t.includes('break-in') || t.includes('vandal')
  ) {
    return 'comprehensive';
  }
  // Third-party or shared fault → a genuine liability question to resolve.
  if (spec.fault === 'third-party' || spec.fault === 'shared') return 'liability';
  // Single-vehicle / own-damage / uninsured-motorist → collision, no liability dispute.
  return 'collision';
}

function isoDaysAgo(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function isoHoursAgo(hours: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - hours, 0, 0, 0);
  return d.toISOString();
}

function blockerForStage(spec: ClaimSpec): string {
  const cls = deriveClaimClass(spec);
  switch (spec.stage) {
    case 'intake':
      return 'New claim awaiting coverage confirmation and FNOL completeness review.';
    case 'investigation':
      switch (cls) {
        case 'fraud':
          return 'SIU fraud investigation in progress; reserve held pending findings.';
        case 'injury':
          return 'Injury assessment and disputed liability under review before quantum can be set.';
        case 'liability':
          return 'Liability apportionment unresolved pending third-party and evidence review.';
        case 'comprehensive':
          return 'Comprehensive peril confirmation and first-party damage assessment in progress.';
        case 'glass':
          return 'Replacement quote received and verified; repair authorisation pending within adjuster authority.';
        case 'collision':
        default:
          return 'Coverage confirmation and own-vehicle damage assessment in progress.';
      }
    case 'evaluation':
      if (cls === 'fraud') return 'SIU review escalated; settlement blocked until fraud signals cleared.';
      if (cls === 'glass') return 'Glass repair cost confirmed; awaiting repair authorisation.';
      if (cls === 'injury') return 'Damage and injury valuation in progress pending medical documentation.';
      return 'Damage assessment and settlement valuation in progress.';
    case 'settlement':
      return cls === 'glass'
        ? 'Glass repair cost prepared and awaiting authorisation within adjuster authority.'
        : 'Settlement figure prepared and awaiting approval within adjuster authority.';
    case 'closed':
      return '';
    default:
      return '';
  }
}

function lastActionForStage(spec: ClaimSpec): string {
  const cls = deriveClaimClass(spec);
  switch (spec.stage) {
    case 'intake':
      return 'Intake agent captured FNOL details and requested coverage verification.';
    case 'investigation':
      switch (cls) {
        case 'fraud':
          return 'Fraud Detection Agent flagged anomalies and referred the claim to SIU.';
        case 'injury':
          return 'Claims agent compiled the injury narrative and requested medical and liability evidence.';
        case 'liability':
          return 'Claims agent assembled the incident narrative and requested liability evidence.';
        case 'comprehensive':
          return 'Claims agent confirmed the comprehensive peril and requested the damage assessment.';
        case 'glass':
          return 'Auto-glass vendor returned the replacement and recalibration quote; full-glass endorsement confirmed.';
        case 'collision':
        default:
          return 'Claims agent confirmed coverage and requested the own-damage assessment.';
      }
    case 'evaluation':
      if (cls === 'glass') return 'Auto-glass vendor returned the replacement and recalibration quote for authorisation.';
      return 'Settlement agent compiled damage valuation inputs for adjuster review.';
    case 'settlement':
      return cls === 'glass'
        ? 'Auto-glass vendor confirmed the repair cost pending authorisation.'
        : 'Settlement Calculation Agent produced a settlement figure pending approval.';
    case 'closed':
      return spec.outcome === 'denied'
        ? 'Claim closed as not covered; decision letter issued to the claimant.'
        : 'Settlement paid and claim closed; confirmation issued to the claimant.';
    default:
      return 'Claim updated.';
  }
}

function coverageApplicability(spec: ClaimSpec): PolicyContext['coverageApplicability'] {
  if (spec.outcome === 'denied') return 'excluded';
  if (spec.stage === 'intake' || (spec.decisionType === 'Coverage Verification' && spec.stage === 'evaluation'))
    return 'ambiguous';
  if (spec.fraud && spec.stage !== 'closed') return 'ambiguous';
  return 'covered';
}

function relevantClauses(spec: ClaimSpec): string[] {
  const clauses: string[] = [];
  const cls = deriveClaimClass(spec);
  if (spec.fault === 'third-party') clauses.push('Section 3 — Third-Party Liability & Recovery');
  if (spec.fault === 'claimant' || spec.fault === 'shared') clauses.push('Section 2 — Collision Coverage');
  if (cls === 'comprehensive' || cls === 'glass') clauses.push('Section 4 — Comprehensive (Non-Collision) Perils');
  if (cls === 'glass') clauses.push('Endorsement G1 — Full Glass, No Deductible');
  if (spec.scenarioTitle.toLowerCase().includes('hit-and-run')) clauses.push('Section 6 — Uninsured Motorist Property Damage');
  if (spec.injury) clauses.push('Section 5 — Medical Payments / Bodily Injury');
  if (spec.decisionType === 'Policy Interpretation') clauses.push('Schedule A — Rental Reimbursement Limits');
  if (!clauses.length) clauses.push('Section 1 — General Coverage Terms');
  return clauses;
}

function buildNarrative(spec: ClaimSpec): NarrativeElement[] {
  const base = spec.daysAgoIncident;
  const elements: NarrativeElement[] = [
    {
      timestamp: isoDaysAgo(base, 8, 15),
      description: `${spec.scenarioTitle} reported. ${spec.description}`,
      status: 'Confirmed',
      source: 'FNOL Intake',
    },
  ];

  if (spec.fault === 'third-party') {
    elements.push({
      timestamp: isoDaysAgo(base, 9, 5),
      description: `Third-party driver ${spec.thirdParty ?? 'on record'} acknowledged fault at the scene; details exchanged.`,
      status: 'Confirmed',
      source: 'Claimant Statement',
    });
  } else if (spec.fault === 'shared') {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 1, 0), 11, 0),
      description: 'Accounts from the insured and third party conflict on right-of-way; liability remains disputed.',
      status: 'Disputed',
      source: 'Party Statements',
    });
  } else if (spec.fault === 'undetermined') {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 1, 0), 10, 30),
      description: spec.scenarioTitle.includes('hit-and-run')
        ? 'No third-party identified; incident treated as uninsured-motorist event pending evidence.'
        : 'No third party involved; loss assessed under first-party coverage.',
      // The first-party cause firms up as the claim advances: pending at intake,
      // an adjuster inference during investigation, and an established fact once
      // valuation has begun — so confirmed/total tracks the confidence score.
      status:
        spec.stage === 'intake'
          ? 'Pending'
          : spec.stage === 'investigation'
          ? 'Inferred'
          : 'Confirmed',
      source: 'Adjuster Review',
    });
  }

  // Glass losses are clear-cut: once past intake the replacement quote is in and
  // verified, which is exactly why a windshield claim reads as high confidence.
  if (deriveClaimClass(spec) === 'glass' && spec.stage !== 'intake') {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 1, 0), 12, 30),
      description:
        'Replacement quote received and verified against the national glass network schedule; ADAS forward-camera recalibration included under the full-glass endorsement (no deductible).',
      status: 'Confirmed',
      source: 'Settlement Calculation Agent',
    });
  }

  if (spec.injury) {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 1, 0), 14, 0),
      description: 'Insured reported soft-tissue neck strain; medical documentation requested for the injury component.',
      status: spec.stage === 'closed' ? 'Confirmed' : 'Pending',
      source: 'Medical Intake',
    });
  }

  if (spec.fraud) {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 1, 0), 22, 40),
      description: 'Damage geometry inconsistent with the described impact; witness contact linked to a prior claim.',
      status: 'Disputed',
      source: 'Fraud Detection Agent',
    });
  }

  if (spec.stage === 'settlement' || spec.stage === 'closed') {
    elements.push({
      timestamp: isoDaysAgo(Math.max(base - 3, 0), 16, 0),
      description:
        spec.outcome === 'denied'
          ? 'Coverage review concluded the loss falls outside policy terms; claim recommended for denial.'
          : `Damage appraisal completed; settlement valued at $${spec.estimate.toLocaleString('en-US')}.`,
      status: 'Confirmed',
      source: 'Settlement Calculation Agent',
    });
  }

  return elements;
}

// ── Glass service channel (tier-aware) ───────────────────────────────────────
// Standard / priority tiers are handled through a national glass network with a
// mobile fit + ADAS recalibration appointment (no courtesy car for a same-day
// job). Top tiers (white_glove / signature) get OEM glass, dealer / OEM-certified
// calibration and a concierge collect-and-return with a loaner as a service.
interface GlassServiceProfile {
  vendor: string;
  vendorType: 'body_shop' | 'oem_dealer';
  concierge: boolean;
}

function glassServiceProfile(tier: ClientServiceTier): GlassServiceProfile {
  const hnw = tier === 'signature' || tier === 'white_glove';
  return hnw
    ? { vendor: 'OEM-Certified Glass (concierge)', vendorType: 'oem_dealer', concierge: true }
    : { vendor: 'National Auto Glass Network', vendorType: 'body_shop', concierge: false };
}

// Concise, sequenced next steps surfaced inside the governed-action box. Richest
// for glass (the lead demo claim); a compact class-aware list elsewhere.
function buildRecommendedSteps(spec: ClaimSpec, cls: ClaimClass, tier: ClientServiceTier): string[] {
  const vehicle = spec.vehicleLabel ?? 'the insured vehicle';
  const open = spec.stage === 'intake' || spec.stage === 'investigation' || spec.stage === 'evaluation';

  if (cls === 'glass') {
    if (spec.stage === 'closed') return [];
    if (spec.stage === 'settlement') {
      return [
        'Release the authorised payment to the glass vendor.',
        'Confirm the ADAS forward-camera recalibration was completed and documented.',
        'Send the claimant a confirmation and close the claim.',
      ];
    }
    const hnw = tier === 'signature' || tier === 'white_glove';
    return hnw
      ? [
          `Confirm the OEM glass quote matches ${vehicle} and the registration on file.`,
          'Verify the full-glass endorsement applies with no deductible and OEM-parts entitlement.',
          'Arrange concierge collection with OEM-certified ADAS recalibration and provide a loaner vehicle.',
          'Complete human review against the endorsement terms before authorising; coordinate via the managing agent.',
        ]
      : [
          `Confirm the glass quote matches ${vehicle} and the registration on file.`,
          'Verify the full-glass endorsement applies with no deductible.',
          'Schedule the mobile windshield replacement plus ADAS forward-camera recalibration (calibration may need a short in-shop visit).',
          'Complete human review of the quote and authorise; no courtesy car is required for a same-day glass job.',
        ];
  }

  if (cls === 'fraud') {
    return spec.stage === 'closed'
      ? []
      : [
          'Maintain the reserve hold; do not progress to settlement.',
          'Complete the SIU investigation and document the anomaly findings.',
          'Escalate to a senior adjuster with the SIU recommendation before any decision.',
        ];
  }

  if (!open) {
    if (spec.stage === 'settlement') {
      return [
        'Confirm the settlement figure is within delegated authority.',
        'Authorise payment and issue the claimant notification.',
        'Record the decision and advance the claim to closure.',
      ];
    }
    return [];
  }

  switch (cls) {
    case 'injury':
      return [
        'Obtain and review the treating-clinic medical report for the reported injury.',
        'Resolve disputed liability with corroborating evidence before setting quantum.',
        'Prepare the combined damage and injury valuation for review.',
      ];
    case 'liability':
      return [
        'Gather corroborating evidence (statements, scene/dashcam) to apportion liability.',
        'Confirm third-party insurer details and coverage.',
        'Complete the liability apportionment before progressing to valuation.',
      ];
    case 'comprehensive':
      return [
        'Confirm the comprehensive peril with supporting evidence (e.g. weather/scene report).',
        'Complete the first-party damage assessment and obtain a repair estimate.',
        'Verify coverage and deductible before preparing the settlement.',
      ];
    case 'collision':
    default:
      return [
        'Confirm collision / uninsured-motorist coverage applies.',
        `Complete the own-vehicle damage assessment for ${vehicle} and obtain a repair estimate.`,
        'Verify the deductible and prepare the valuation for review.',
      ];
  }
}

function buildEvidence(spec: ClaimSpec): EvidenceItem[] {
  const verified = spec.stage === 'closed' || spec.stage === 'settlement';
  const base = spec.daysAgoIncident;
  const items: EvidenceItem[] = [
    {
      id: `${spec.claimId}-EV1`,
      type: 'Photographs',
      description: `Damage photos of ${spec.vehicleLabel ?? 'the insured vehicle'}.`,
      source: 'Claimant mobile upload',
      provenance: 'Claimant Provided',
      dateReceived: isoDaysAgo(base, 9, 30),
      status: 'verified',
    },
    {
      id: `${spec.claimId}-EV2`,
      type: 'FNOL Statement',
      description: 'Recorded first-notice-of-loss statement and incident summary.',
      source: 'FNOL session',
      provenance: 'Claimant Provided',
      dateReceived: isoDaysAgo(base, 8, 20),
      status: 'verified',
      ...(spec.claimant === 'andre' ? {
        content: `FIRST NOTICE OF LOSS — FNOL SESSION TRANSCRIPT
Claim Reference: ${spec.claimId}
Channel: Mobile App  |  Date: ${isoDaysAgo(base, 8, 20).slice(0, 10)}  |  Time: 14:32 CST
Agent (AI): MID Intake Agent v2  |  Claimant: Andre Coleman

─────────────────────────────────────────────────────────
AGENT:  Good afternoon, Mr Coleman. I'm the MID intake agent. I'll take your first notice of loss today. Can you confirm the policy reference and the vehicle involved?

CLAIMANT:  Sure — policy POL-AUTO-US-2026-AC01, and the vehicle is my 2022 Cadillac XT5 Premium Luxury, plate MID-6648.

AGENT:  Thank you. Can you describe what happened and when?

CLAIMANT:  It was this morning, around 7:45 AM. I was southbound on I-75, near Exit 51. A truck ahead of me kicked up a chunk of road debris — looked like loose gravel or chipped asphalt — and it hit my windshield dead-on. Put a crack right across the driver's side, about eight inches long. It happened fast, no time to avoid it.

AGENT:  Was anyone else involved — other vehicles, a third party?

CLAIMANT:  No other vehicle was directly involved. It came off the road surface itself — the road's been in rough shape out there for a while.

AGENT:  Were there any injuries to you or any passengers?

CLAIMANT:  No, no injuries. Just the windshield.

AGENT:  Did you stop at the scene, and did you contact the authorities?

CLAIMANT:  I pulled over briefly to check the damage, then drove to work. Didn't call the police — it was a road debris hit, not a collision. Should I have?

AGENT:  For a single-vehicle glass claim of this nature, a police report is not required. I've noted the circumstances. Do you have photos of the damage?

CLAIMANT:  Yes, I took photos right there on the shoulder. I'll upload them through the app.

AGENT:  Perfect. I've opened claim ${spec.claimId} and flagged it as a glass claim — road debris, single vehicle, no injury. Your adjuster will be in touch within one business day. Is there anything else you'd like to add?

CLAIMANT:  No, I think that covers it. How long does the repair usually take?

AGENT:  Glass claims of this type typically complete within 2–3 business days once a repair quote is authorised. You'll receive a notification at each stage. Thank you, Mr Coleman.

─────────────────────────────────────────────────────────
SESSION END — Duration: 6 min 14 sec
Auto-summary: Single-vehicle glass claim. Road debris (I-75 SB, Exit 51). Windshield crack ~8 in. No injury. No third party. Photos pending upload. Claim created.`,
      } : spec.claimant === 'patricia' ? {
        content: `FIRST NOTICE OF LOSS — FNOL SESSION TRANSCRIPT
Claim Reference: ${spec.claimId}
Channel: Phone  |  Date: ${isoDaysAgo(base, 8, 20).slice(0, 10)}  |  Time: 09:17 EST
Agent (AI): MID Intake Agent v2  |  Claimant: Patricia O'Connor

─────────────────────────────────────────────────────────
AGENT:  Good morning, Ms O'Connor. You've reached the MID claims intake line. I'm the automated intake agent. May I take your policy reference?

CLAIMANT:  Yes — it's POL-AUTO-US-2026-PO01. My name is Patricia O'Connor.

AGENT:  Thank you, Ms O'Connor. I can see your 2024 Porsche Cayenne S on that policy. Can you tell me what's happened?

CLAIMANT:  I parked at the retail centre on Boylston Street this morning — I was in there maybe forty minutes — and when I came back to my car, the driver-side door and the front quarter-panel had been hit. Significant damage. Whoever did it just drove off. There was no note, nothing.

AGENT:  I'm sorry to hear that. To confirm — the vehicle was unattended and parked at the time of the damage?

CLAIMANT:  Yes, completely unattended. Level 2 of the car park, bay near the lift. I'd parked there because I always park away from other cars to avoid exactly this sort of thing.

AGENT:  Did you see the other vehicle or anyone involved?

CLAIMANT:  No. By the time I got back, whoever it was had gone. There were a couple of other cars nearby but no one around.

AGENT:  Have you contacted the police?

CLAIMANT:  Yes — I called Brookline PD from the car park. An officer came and took a report. He said they'd request CCTV from the car park management. The report reference is BPD-2026-47291.

AGENT:  I have that noted. Can you describe the damage?

CLAIMANT:  The driver door is badly dented — the panel is buckled and there's paint transfer, dark coloured. The front quarter-panel also has impact damage. It's going to need panel replacement, not just a respray.

AGENT:  Have you arranged or obtained a repair estimate yet?

CLAIMANT:  Not yet. I'll take it to Porsche of Brookline — they're the authorised dealer I always use.

AGENT:  That's fine. I've created claim ${spec.claimId} — unattended vehicle damage, hit-and-run, no injury. Given your service tier, I'm flagging this for priority handling. Your dedicated adjuster will contact you within four business hours. Is there anything else?

CLAIMANT:  No, I think that's everything. Please do make sure someone follows up on the CCTV — I'd like to know who did this.

AGENT:  Absolutely noted. We'll liaise with your adjuster to ensure that's tracked. Thank you, Ms O'Connor.

─────────────────────────────────────────────────────────
SESSION END — Duration: 8 min 42 sec
Auto-summary: Hit-and-run, unattended vehicle. Driver door + front quarter-panel damage. Police report BPD-2026-47291 filed. CCTV request in progress. No injury. Repair estimate to follow — Porsche of Brookline.`,
      } : spec.claimant === 'rafael' ? {
        content: `FIRST NOTICE OF LOSS — FNOL SESSION TRANSCRIPT
Claim Reference: ${spec.claimId}
Channel: Mobile App  |  Date: ${isoDaysAgo(base, 8, 20).slice(0, 10)}  |  Time: 19:55 EST
Agent (AI): MID Intake Agent v2  |  Claimant: Rafael Santos

─────────────────────────────────────────────────────────
AGENT:  Good evening, Mr Santos. I'm the MID intake agent. I'm here to take your first notice of loss. Can you confirm your policy reference and vehicle?

CLAIMANT:  Policy is POL-AUTO-US-2026-RS01. The vehicle is my 2024 Mercedes GLC 300, plate FLM-1123.

AGENT:  Thank you. Can you describe what happened?

CLAIMANT:  There was a flash flood warning this afternoon — you know how fast these come up in Miami. I was at work and by the time I got back to my car, which was parked on the street, the water level had risen significantly. It was above the door sills for at least a couple of hours based on the water line I can see on the door frames. The car won't start now and there's standing water inside the cabin.

AGENT:  Approximately what time did the flooding occur, and where was the vehicle parked?

CLAIMANT:  It's a low-lying street off Brickell — SW 15th Road. The flooding started around 4 PM based on the city's alerts. My car was parked there since 8 AM.

AGENT:  Were there any other vehicles or people involved?

CLAIMANT:  No other parties. It was the flood. My neighbour's car was also affected — it's a known problem with that street.

AGENT:  Did you attempt to move the vehicle before the flooding reached it?

CLAIMANT:  No, I had no warning it would reach that level. The forecast said heavy rain but not what happened. I wasn't near the car.

AGENT:  Have you contacted emergency services or the city?

CLAIMANT:  I called 311 to report the flooding. I also have the NOAA flash flood advisory that was issued. I haven't driven the vehicle or attempted to start it since.

AGENT:  That's important — please don't attempt to start it until it's been assessed. Water ingestion into the drivetrain can cause significant additional damage. I've created claim ${spec.claimId} — comprehensive peril, flash-flood water damage. Given the potential for total-loss threshold, this will be assigned to a senior adjuster for policy interpretation review. Someone will contact you within two business hours. Is there anything else?

CLAIMANT:  Just — will the policy cover this? I wasn't negligent, I didn't drive it into the flood.

AGENT:  Your comprehensive coverage includes flood and water-damage perils. Policy interpretation review will confirm the specific coverage position once the adjuster has assessed the damage. Thank you, Mr Santos.

─────────────────────────────────────────────────────────
SESSION END — Duration: 7 min 28 sec
Auto-summary: Comprehensive peril — flash flood, stationary parked vehicle. Miami, FL (Brickell, SW 15th Rd). Suspected drivetrain and electrical water ingestion. Vehicle undrivable. No prior attempt to start. NOAA advisory referenced. 311 flood report filed. Policy interpretation / potential total-loss review required.`,
      } : {}),
    },
  ];

  if (spec.fault === 'third-party' || spec.fault === 'shared') {
    items.push({
      id: `${spec.claimId}-EV3`,
      type: 'Third-Party Details',
      description: `Exchanged details for third party ${spec.thirdParty ?? 'on record'}, including insurer and registration.`,
      source: 'Scene exchange',
      provenance: 'Third Party',
      dateReceived: isoDaysAgo(base, 9, 45),
      status: spec.fault === 'shared' ? 'disputed' : verified ? 'verified' : 'pending',
    });
  }

  if (spec.injury) {
    items.push({
      id: `${spec.claimId}-EV4`,
      type: 'Medical Report',
      description: 'Initial medical assessment for reported soft-tissue injury.',
      source: 'Treating clinic',
      provenance: 'Third Party',
      dateReceived: isoDaysAgo(Math.max(base - 1, 0), 15, 0),
      status: spec.stage === 'closed' ? 'verified' : 'pending',
    });
  }

  if (spec.scenarioTitle.toLowerCase().includes('hail')) {
    items.push({
      id: `${spec.claimId}-EV3`,
      type: 'Weather Report',
      description: 'NOAA storm report confirming hail of damaging size at the location and time.',
      source: 'NOAA',
      provenance: 'Public Record',
      dateReceived: isoDaysAgo(base, 12, 0),
      status: 'verified',
    });
  }

  if (spec.fraud) {
    items.push({
      id: `${spec.claimId}-EV5`,
      type: 'SIU Analysis',
      description: 'Special Investigations Unit anomaly report flagging damage and witness inconsistencies.',
      source: 'SIU',
      provenance: 'Agent Inferred',
      dateReceived: isoDaysAgo(Math.max(base - 1, 0), 23, 10),
      status: 'disputed',
    });
  }

  if (deriveClaimClass(spec) === 'glass') {
    const tier = ROSTER[spec.claimant].tier;
    const profile = glassServiceProfile(tier);
    // At intake the quote is still being gathered; from investigation onward the
    // quote has been received and verified, so the only open item is the human
    // authorisation of the repair (the governed-settlement decision).
    const quoteVerified = spec.stage !== 'intake';
    items.push({
      id: `${spec.claimId}-EV3`,
      type: 'Repair Quote',
      description: `Itemised windshield-replacement quote from ${profile.vendor} — OEM glass unit, ADAS forward-camera recalibration and ${profile.concierge ? 'concierge fitting' : 'mobile fitting'}. Total $${spec.estimate.toLocaleString('en-US')}.`,
      source: profile.vendor,
      provenance: 'Third Party',
      dateReceived: isoDaysAgo(Math.max(base - 1, 0), 11, 30),
      status: quoteVerified ? 'verified' : 'pending',
      content: `NATIONAL AUTO GLASS NETWORK
Repair & Replacement Quotation

Quote Reference: NAGN-2026-CLM-${spec.claimId}-Q01
Date Issued: ${isoDaysAgo(Math.max(base - 1, 0), 11, 30).slice(0, 10)}
Prepared For: Midland Insurance Direct — Claims Department
Claim Reference: ${spec.claimId}
Claimant: Andre Coleman
Vehicle: 2022 Ford F-150 SuperCrew  |  VIN: 1FTFW1E82NFC•••••  |  Plate: MIC-4892

──────────────────────────────────────────────────────────────────

SERVICE LOCATION
National Auto Glass Network — Detroit Metro Hub
Mobile Service Unit MSU-14, dispatched to claimant address
Technician: James Okafor (Cert. AGT-Level III, NAGC Accredited)

──────────────────────────────────────────────────────────────────

DAMAGE ASSESSMENT
Damage Type: Road-debris impact (stone strike), driver-side windshield
Location of Damage: Approx. 30 cm from top-centre, driver side
Nature of Damage: Star-burst fracture approx. 4.5 cm diameter with two radiating stress cracks (9 cm and 7 cm). Damage is not repairable — full replacement required per NAGC safety standard NS-GL-04.

──────────────────────────────────────────────────────────────────

LINE ITEM QUOTATION

  Item                                         Part No.        Qty   Unit Price    Total
  ─────────────────────────────────────────────────────────────────────────────────────
  OEM Windshield Glass Unit                    FL3Z-2503100-A    1      $487.00    $487.00
  (Ford Genuine Parts — acoustic laminate,
   heated washer nozzle, rain sensor strip)

  Urethane Bonding Adhesive (fast-cure)        LET-1717-FC       1       $38.00     $38.00
  Moulding & Clip Set                          FL3Z-2503170-A    1       $24.00     $24.00
  Labour — Windshield Removal & Replacement    —                 1      $185.00    $185.00
  Drive-away Safe Period (60-min cure hold)    —                 —           —          —

  ADAS Recalibration — Forward-Facing Camera   ADAS-FORD-FFC     1      $295.00    $295.00
  (Static recalibration, certified OEM         
   procedure per Ford TSB 22-2012)

  Mobile Dispatch & Setup Fee                  —                 1       $45.00     $45.00
  ─────────────────────────────────────────────────────────────────────────────────────
  Subtotal                                                                         $1,074.00
  Tax (6% Michigan)                                                                   $64.44
  ─────────────────────────────────────────────────────────────────────────────────────
  TOTAL                                                                           $1,138.44

──────────────────────────────────────────────────────────────────

IMPORTANT NOTES

1. ADAS RECALIBRATION — MANDATORY
   The 2022 Ford F-150 is equipped with a Ford Co-Pilot360 forward-facing camera
   mounted to the windshield. Full static recalibration is required after any
   windshield replacement per Ford Technical Service Bulletin 22-2012. Skipping
   recalibration will render the lane-keep assist, automatic emergency braking,
   and adaptive cruise control inoperative or unreliable. This item MUST be
   included in any authorised repair scope.

2. PARTS SPECIFICATION
   Quote uses Ford Genuine OEM glass with acoustic laminate and heated washer
   nozzle — these features are present on the original unit and must be preserved.
   Aftermarket glass will not be used unless explicitly authorised by the insurer
   and claimant.

3. VALIDITY
   This quotation is valid for 30 days from the date of issue.
   Parts pricing subject to availability at time of order.

4. AUTHORISATION
   Work will commence within 24 hours of written authorisation from Midland
   Insurance Direct. Claimant will be contacted directly to schedule a convenient
   fitting window.

──────────────────────────────────────────────────────────────────

Authorised Signatory: James Okafor, Regional Operations Lead
National Auto Glass Network  |  NAGC Accredited Member
Tel: (313) 555-0188  |  claims@nagn-network.com

— End of Quotation —`,
    });
  }

  // ── Claimant-specific corroborating evidence (text documents) ────────────
  if (spec.claimant === 'andre') {
    // Highway stone strike — fellow motorist witness + MDOT road condition log
    items.push(
      {
        id: `${spec.claimId}-EV4`,
        type: 'Road Surface Report',
        description:
          'Michigan DOT maintenance log confirming loose aggregate on I-75 southbound near Exit 51 (Highway near Detroit, MI) on the date of loss. Log cross-references an outstanding resurfacing order filed two days prior. Corroborates claimant account of road-debris origin.',
        source: 'Michigan DOT (MDOT)',
        provenance: 'Public Record',
        dateReceived: isoDaysAgo(Math.max(base - 1, 0), 16, 45),
        status: 'verified',
        content: `MICHIGAN DEPARTMENT OF TRANSPORTATION
Road Maintenance & Incident Log

Report Reference: MDOT-M25-2026-I75-0621
Date of Log Entry: ${isoDaysAgo(Math.max(base - 1, 0), 16, 45).slice(0, 10)}
Route: I-75 Southbound
Location: Near Exit 51 — Highway Corridor, Detroit Metro Area
Logged By: Region 1 Operations Centre

SUMMARY
A highway maintenance inspection on the date of loss identified loose aggregate material on the travelled carriageway surface of I-75 Southbound in the vicinity of Exit 51. Conditions consistent with fragmented surface dressing and stone chip debris ejection.

MAINTENANCE HISTORY
A resurfacing work order (WO-MDOT-I75-SB-06-19) was filed two days prior to the date of loss, citing surface dressing deterioration on the same stretch. The order was pending contractor scheduling at the time of the incident.

INCIDENT RELEVANCE
Road surface conditions at this location on the date reported are consistent with loose stone / aggregate debris being present on the carriageway, which may be ejected by passing vehicles and strike following traffic. No adverse weather conditions noted on the date of loss.

CONCLUSION
The maintenance log and open work order corroborate reports of road-debris origin for vehicle glass damage claims occurring on this stretch of I-75 Southbound on or around the date of loss.

— End of Report —`,
      },
    );
  }

  if (spec.claimant === 'patricia') {
    // Parking-lot hit-and-run — police report + CCTV request + dealer estimate
    items.push(
      {
        id: `${spec.claimId}-EV3`,
        type: 'Police Report',
        description:
          "Brookline Police Department incident report #BPD-2026-47291 for unattended vehicle damage in a retail parking lot. Hit-and-run; no suspect identified at time of filing. Report confirms date, location and damage description are consistent with claimant's account.",
        source: 'Brookline PD',
        provenance: 'Public Record',
        dateReceived: isoDaysAgo(base, 10, 30),
        status: 'verified',
        content: `BROOKLINE POLICE DEPARTMENT
Incident Report #BPD-2026-47291

Date: ${isoDaysAgo(base, 10, 30).slice(0, 10)}
Reporting Officer: Officer T. Reyes, Badge #4412
Location: Retail Parking Lot, Boylston Street, Brookline, MA

INCIDENT SUMMARY
At approximately 08:15 hrs, the complainant Patricia O'Connor reported that her 2024 Porsche Cayenne S (MA Registration: MAB-4417) sustained damage while unattended in a retail parking lot. The complainant returned to her vehicle to find damage to the driver-side door and front quarter-panel. No third party was present at the scene and no contact information was left.

DAMAGE DESCRIPTION
Significant impact damage to driver-side door panel and front left quarter-panel. Paint damage and structural deformation consistent with a low-speed vehicle impact from an adjacent parking space.

INVESTIGATION
CCTV footage request submitted to the retail centre property management (Level 2 parking bay area). No witnesses identified at scene. No suspect vehicle identified at time of filing.

STATUS
Case open — unattended vehicle damage, uninsured motorist event. Investigation ongoing pending CCTV review.

— End of Report —`,
      },
      {
        id: `${spec.claimId}-EV4`,
        type: 'CCTV Footage Request',
        description:
          'Formal camera-footage request submitted to the retail centre property management team for the Level 2 parking bay area covering the incident window. Footage review pending 5–7 business days; management has confirmed footage exists and is being preserved.',
        source: 'Retail Centre Property Management',
        provenance: 'Third Party',
        dateReceived: isoDaysAgo(Math.max(base - 1, 0), 13, 0),
        status: 'pending',
      },
      {
        id: `${spec.claimId}-EV5`,
        type: 'Repair Estimate',
        description:
          "Written repair estimate from Porsche of Brookline (authorised dealer) for driver-side door and quarter-panel body and paint work on the 2024 Cayenne S (MAB-4417). Total estimate $4,984 — consistent with damage assessment photographs. Includes O'Connor's preferred OEM parts specification.",
        source: 'Porsche of Brookline',
        provenance: 'Third Party',
        dateReceived: isoDaysAgo(Math.max(base - 1, 0), 15, 0),
        status: 'verified',
        content: `PORSCHE OF BROOKLINE — AUTHORISED SERVICE CENTRE
Repair Estimate

Estimate Reference: POB-EST-2026-4471
Date: ${isoDaysAgo(Math.max(base - 1, 0), 15, 0).slice(0, 10)}
Customer: Patricia O'Connor
Vehicle: 2024 Porsche Cayenne S  |  VIN: WP1AF2AY4PDA••••••  |  Registration: MAB-4417
Mileage: 12,847 miles

SCOPE OF WORK
| Item                                      | Part No.        | Qty | Unit    | Total    |
|-------------------------------------------|-----------------|-----|---------|----------|
| Driver door outer panel (OEM)             | 95B-831-051-GRV |   1 | $1,840  | $1,840   |
| Front left quarter-panel repair & reshape |        —        |   1 | $   680  | $   680  |
| Body filler, primer, sealer               |        —        |   1 | $   210  | $   210  |
| Paint — Jet Black Metallic (M9T)          |        —        |   1 | $   854  | $   854  |
| Clear coat and polish                     |        —        |   1 | $   320  | $   320  |
| Colour blend (adjacent panels)            |        —        |   2 | $   240  | $   480  |
| Labour (9.5 hrs @ $63/hr)                 |        —        |   1 | $   599  | $   599  |
| Sundries and consumables                  |        —        |   1 | $     1  | $     1  |

TOTAL ESTIMATE: $4,984 (USD)
Parts specification: OEM only per customer preference.
Deductible: subject to policy terms — not deducted from this estimate.

Authorised by: Service Manager, Porsche of Brookline
— End of Estimate —`,
      },
    );
  }

  if (spec.claimant === 'rafael') {
    // Flash-flood, Miami — NOAA advisory + Mercedes dealer water-damage assessment
    items.push(
      {
        id: `${spec.claimId}-EV3`,
        type: 'NOAA Flood Advisory',
        description:
          'National Weather Service Miami flash-flood advisory FLA-FF-2026-0614 issued for Miami-Dade County on the date of loss. Advisory confirms rapid inundation of low-lying streets in the Brickell district, with water depths reaching 18–24 in above kerb level in affected zones.',
        source: 'NOAA / National Weather Service Miami',
        provenance: 'Public Record',
        dateReceived: isoDaysAgo(base, 10, 0),
        status: 'verified',
        content: `NATIONAL WEATHER SERVICE — MIAMI, FL
Flash Flood Advisory
Advisory Reference: FLA-FF-2026-0614
Issued: ${isoDaysAgo(base, 10, 0).slice(0, 10)} at 15:47 EST
Expires: ${isoDaysAgo(base, 10, 0).slice(0, 10)} at 21:00 EST

FLASH FLOOD ADVISORY IN EFFECT FOR MIAMI-DADE COUNTY

AFFECTED AREA
Low-lying streets and residential corridors in the Brickell, Little Havana and Coconut Grove districts, including but not limited to: SW 15th Road corridor (Brickell), SW 8th Street (Calle Ocho) between SW 22nd–32nd Avenues, and NW 7th Avenue south of NW 14th Street.

SUMMARY
A slow-moving upper-level low-pressure system brought 3.8 inches of rainfall to central Miami-Dade County between 13:00 and 18:30 EST today, exceeding the storm-drain capacity of several low-lying roadways. Flash flooding was observed and reported across the Brickell district from approximately 15:30 EST onward.

FLOOD OBSERVATIONS (as of 17:00 EST)
- SW 15th Road (Brickell): water depth estimated at 18–24 inches above kerb level at peak inundation. Multiple vehicles reported stranded. Miami-Dade Fire Rescue dispatched to assist.
- Multiple street-level parking areas in the Brickell corridor affected.
- Water began receding from approximately 18:15 EST following storm-drain clearance operations.

IMPACT ASSESSMENT
Vehicles parked in affected low-lying areas were exposed to standing water well above door-sill height for an estimated 2–3 hour window at peak inundation. Electrical system, drivetrain, and interior water ingestion damage is consistent with observed flood depths.

This advisory corroborates reports of vehicle flood damage occurring on SW 15th Road, Miami, FL on the date of loss.

— End of Advisory —
Source: NOAA / National Weather Service Miami  |  nws.noaa.gov/miami`,
      },
      {
        id: `${spec.claimId}-EV4`,
        type: 'Dealer Damage Assessment',
        description:
          'Mercedes-Benz of Miami preliminary water-damage assessment for 2024 GLC 300 (FLM-1123). Confirmed water ingestion to cabin, drivetrain ECU and electrical systems. Preliminary estimate $14,200–$21,400 pending full strip-down; total-loss threshold flagged for insurer review.',
        source: 'Mercedes-Benz of Miami',
        provenance: 'Third Party',
        dateReceived: isoDaysAgo(Math.max(base - 1, 0), 11, 0),
        status: 'verified',
        content: `MERCEDES-BENZ OF MIAMI — AUTHORISED SERVICE CENTRE
Preliminary Water-Damage Assessment

Assessment Reference: MBOM-WDA-2026-0882
Date: ${isoDaysAgo(Math.max(base - 1, 0), 11, 0).slice(0, 10)}
Assessor: Senior Technician R. Morales, MB-Certified (EM-Class / GLC)
Customer: Rafael Santos
Vehicle: 2024 Mercedes-Benz GLC 300 4MATIC  |  VIN: W1N0G8EB3RF••••••  |  Plate: FLM-1123
Mileage: 18,204 miles

PRESENTING CONDITION
Vehicle delivered by flatbed — non-driveable. Visible water-line on door skins and interior panels at approximately 21 inches above floor level. Significant standing water residue in cabin. No attempt to start made since incident (correct).

PRELIMINARY FINDINGS

1. CABIN & INTERIOR
   - Front and rear carpet/underlay saturated; water ingress confirmed at door seal level.
   - Centre console and dashboard interior dampness consistent with submersion.
   - Seat foam and fabric — full replacement required on all four seats.

2. ELECTRICAL & ELECTRONICS
   - BCM (Body Control Module) fault codes active: U0100, U0155, U0401 (multiple CAN bus failures).
   - MBUX infotainment system non-responsive.
   - Forward camera array (ADAS) — status unknown pending strip-down.
   - High-voltage 48V mild-hybrid battery module — requires OEM diagnostic protocol before assessment.

3. DRIVETRAIN & POWERTRAIN
   - Engine will not start. Intake air-box shows moisture ingestion.
   - Gearbox (9G-Tronic) hydraulic fluid contamination suspected — full replacement indicated.
   - Transfer case — requires strip and inspection.

PRELIMINARY COST ESTIMATE
| Category                        | Estimate Range      |
|---------------------------------|---------------------|
| Cabin strip & dry-out           | $1,200 – $1,800     |
| Interior replacement (OEM)      | $3,800 – $4,600     |
| Electrical / ECU replacement    | $4,100 – $6,200     |
| Drivetrain (gearbox / transfer) | $4,600 – $7,400     |
| Labour (est. 42–58 hrs)         | $   500 – $1,400    |
| TOTAL PRELIMINARY               | $14,200 – $21,400   |

NOTE: This is a PRELIMINARY assessment only. Full strip-down may reveal additional damage. The upper estimate range approaches the total-loss threshold for this vehicle (ACV approximately $62,000). Insurer review of total-loss determination is recommended before authorising repair.

Authorised by: Service Manager, Mercedes-Benz of Miami
— End of Preliminary Assessment —`,
      },
    );
  }

  return items;
}

function buildAnomalies(spec: ClaimSpec): AnomalySignal[] {
  if (spec.fraud) {
    return [
      {
        id: `${spec.claimId}-AN1`,
        type: 'Damage Inconsistency',
        description: 'Impact damage geometry inconsistent with the reported collision dynamics.',
        severity: 'high',
        evidenceSource: 'SIU Analysis',
        explanation: 'Crush pattern suggests a different angle/speed than described, indicating possible staging.',
      },
      {
        id: `${spec.claimId}-AN2`,
        type: 'Linked Party',
        description: 'Witness phone number matches a contact on a previously settled claim.',
        severity: 'high',
        evidenceSource: 'Claims History Match',
        explanation: 'Repeat associations across unrelated claims are a recognised organised-fraud indicator.',
      },
      {
        id: `${spec.claimId}-AN3`,
        type: 'Late Notification',
        description: 'Incident reported with notable delay and limited contemporaneous evidence.',
        severity: 'medium',
        evidenceSource: 'FNOL Timeline',
        explanation: 'Delayed notification reduces verifiability and is weighted as a secondary fraud signal.',
      },
    ];
  }

  if (spec.fault === 'shared') {
    return [
      {
        id: `${spec.claimId}-AN1`,
        type: 'Liability Conflict',
        description: 'Insured and third party give conflicting right-of-way accounts.',
        severity: 'medium',
        evidenceSource: 'Party Statements',
        explanation: 'Conflicting accounts require corroboration before liability and quantum can be finalised.',
      },
    ];
  }

  return [];
}

function buildRecommendedAction(spec: ClaimSpec, agentName: string): RecommendedAction {
  const currency = 'USD';
  const cls = deriveClaimClass(spec);
  const money = (n: number): string => `$${n.toLocaleString('en-US')}`;

  // Build a breakdown whose components sum EXACTLY to the estimate (the last
  // line absorbs any rounding remainder), so the line items always reconcile.
  let breakdown: { category: string; amount: number; description: string }[] = [];
  if (spec.estimate) {
    if (spec.injury) {
      const medical = Math.round(spec.estimate * 0.35);
      const lossAdj = Math.round(spec.estimate * 0.1);
      const repair = spec.estimate - medical - lossAdj;
      breakdown = [
        { category: 'Repair / Property Damage', amount: repair, description: 'Vehicle repair / property damage component.' },
        { category: 'Bodily Injury / Medical', amount: medical, description: 'Medical and bodily-injury component.' },
        { category: 'Loss-Adjustment & Ancillary', amount: lossAdj, description: 'Loss-adjustment and ancillary handling costs.' },
      ];
    } else if (cls === 'glass') {
      const calibration = Math.round(spec.estimate * 0.18);
      const glassUnit = spec.estimate - calibration;
      breakdown = [
        { category: 'Windshield Replacement', amount: glassUnit, description: 'OEM laminated glass unit and mobile fitting.' },
        { category: 'ADAS Recalibration', amount: calibration, description: 'Forward-camera / sensor recalibration after replacement.' },
      ];
    } else {
      const lossAdj = Math.round(spec.estimate * 0.1);
      const repair = spec.estimate - lossAdj;
      breakdown = [
        { category: 'Repair / Property Damage', amount: repair, description: 'Vehicle repair / property damage component.' },
        { category: 'Loss-Adjustment & Ancillary', amount: lossAdj, description: 'Loss-adjustment, rental and ancillary costs.' },
      ];
    }
  }

  const tier = ROSTER[spec.claimant].tier;
  const financialImpact: NonNullable<RecommendedAction['financialImpact']> = {
    estimatedAmount: spec.estimate,
    currency,
    breakdown,
  };
  if (cls === 'glass' && spec.estimate) {
    const profile = glassServiceProfile(tier);
    // The agent accepts (validates) the quote as soon as it is received; the human
    // then authorises the settlement. Only at intake is it still pending review.
    const quoteAccepted = spec.stage !== 'intake';
    financialImpact.repairQuotes = [
      {
        id: `${spec.claimId}-Q1`,
        vendor: profile.vendor,
        vendorType: profile.vendorType,
        amount: spec.estimate,
        currency,
        receivedDate: isoDaysAgo(Math.max(spec.daysAgoIncident - 1, 0), 11, 30).slice(0, 10),
        status: quoteAccepted ? 'accepted' : 'pending_review',
        notes: profile.concierge
          ? 'OEM glass + dealer ADAS calibration; concierge collect-and-return with loaner.'
          : 'OEM/OEE glass, mobile fit + ADAS recalibration appointment.',
      },
    ];
  }

  let actionType: string;
  let description: string;
  let estimatedImpact: string;

  switch (spec.stage) {
    case 'intake':
      if (cls === 'glass') {
        actionType = 'Verify Glass Coverage';
        description = 'Confirm the full-glass endorsement applies and authorise same-week replacement; no liability or third party involved.';
        estimatedImpact = `Glass replacement exposure of ~${money(spec.estimate)} under the no-deductible endorsement.`;
      } else {
        actionType = 'Verify Coverage';
        description = 'Confirm active coverage and complete FNOL validation before routing to assessment.';
        estimatedImpact = `Exposure estimated at ${money(spec.estimate)} pending coverage confirmation.`;
      }
      break;
    case 'investigation':
      switch (cls) {
        case 'fraud':
          actionType = 'Refer to SIU';
          description = 'Hold reserve and complete SIU investigation before any settlement consideration.';
          estimatedImpact = 'Potential leakage avoided if staged-collision indicators are confirmed.';
          break;
        case 'injury':
          actionType = 'Assess Injury & Liability';
          description = 'Progress the bodily-injury assessment and resolve disputed liability before quantum is set.';
          estimatedImpact = `Working exposure of ${money(spec.estimate)} across damage and injury, subject to liability and medicals.`;
          break;
        case 'liability':
          actionType = 'Resolve Liability';
          description = 'Gather corroborating evidence and apportion liability before valuation.';
          estimatedImpact = `Working exposure of ${money(spec.estimate)} subject to liability apportionment.`;
          break;
        case 'comprehensive':
          actionType = 'Assess Damage & Coverage';
          description = 'Confirm the comprehensive peril and complete the first-party damage assessment; no third-party liability applies.';
          estimatedImpact = `First-party exposure of ${money(spec.estimate)} subject to damage assessment.`;
          break;
        case 'glass':
          actionType = 'Approve Glass Repair';
          description = 'Authorise the windshield replacement under the full-glass endorsement; no liability or third party involved.';
          estimatedImpact = `Glass replacement of ~${money(spec.estimate)} under the no-deductible endorsement.`;
          break;
        case 'collision':
        default:
          actionType = 'Confirm Coverage & Assess Damage';
          description = 'Confirm collision / uninsured-motorist coverage and assess own-vehicle damage; single-vehicle event with no third-party liability.';
          estimatedImpact = `Own-damage exposure of ${money(spec.estimate)} subject to assessment.`;
          break;
      }
      break;
    case 'evaluation':
      if (cls === 'fraud') {
        actionType = 'Continue SIU Review';
        description = 'Maintain reserve hold; do not progress to settlement until fraud signals are cleared.';
        estimatedImpact = 'Reserve held; settlement blocked pending investigation outcome.';
      } else if (cls === 'glass') {
        actionType = 'Approve Glass Repair';
        description = `Authorise the prepared glass replacement and recalibration cost of ${money(spec.estimate)} under the endorsement.`;
        estimatedImpact = `Glass replacement of ${money(spec.estimate)} ready for authorisation.`;
      } else if (cls === 'injury') {
        actionType = 'Prepare Injury Settlement';
        description = 'Finalise medical documentation and prepare the combined damage and injury settlement.';
        estimatedImpact = `Combined settlement valued near ${money(spec.estimate)} including the injury component.`;
      } else {
        actionType = 'Complete Damage Valuation';
        description = 'Finalise damage valuation and prepare a settlement recommendation.';
        estimatedImpact = `Settlement valued near ${money(spec.estimate)}.`;
      }
      break;
    case 'settlement':
      if (cls === 'glass') {
        actionType = 'Approve Glass Repair';
        description = `Authorise the prepared glass replacement cost of ${money(spec.estimate)} within authority and release payment to the vendor.`;
        estimatedImpact = `Glass replacement of ${money(spec.estimate)} ready for payment.`;
      } else {
        actionType = 'Approve Settlement';
        description = `Approve the prepared settlement of ${money(spec.estimate)} within authority and issue payment.`;
        estimatedImpact = `Settlement of ${money(spec.estimate)} ready for payment.`;
      }
      break;
    case 'closed':
    default:
      actionType = spec.outcome === 'denied' ? 'Claim Denied' : 'Claim Settled';
      description =
        spec.outcome === 'denied'
          ? 'Loss fell outside policy terms; claim closed with a decision letter.'
          : `Settlement of ${money(spec.estimate)} paid; claim closed.`;
      estimatedImpact = spec.outcome === 'denied'
        ? 'No payment made.'
        : cls === 'glass'
        ? `${money(spec.estimate)} glass replacement paid and closed.`
        : `${money(spec.estimate)} paid and closed.`;
      break;
  }

  return {
    actionType,
    description,
    confidence: spec.confidence,
    rationale: `${spec.scenarioTitle}. ${spec.description}`,
    estimatedImpact,
    agentId: 'agent_claims_settlement',
    agentName,
    recommendedSteps: buildRecommendedSteps(spec, cls, tier),
    financialImpact,
  };
}

function buildClaimNotes(spec: ClaimSpec): ClaimNote[] | undefined {
  const name = ROSTER[spec.claimant]?.name ?? '';
  if (name === 'Andre Coleman') {
    return [
      {
        id: 'NOTE-ANDRE-001',
        author: 'Jordan Reyes',
        authorRole: 'Claims Intake Specialist',
        category: 'general',
        text: 'Claimant called in at 14:32. Very cooperative throughout FNOL. Confirmed driving northbound on I-75 when the incident occurred — spontaneously provided mile marker reference before being asked. No injury indicated. Vehicle is driveable. Rental car not required.',
        createdAt: '2026-06-10T14:45:00Z',
      },
      {
        id: 'NOTE-ANDRE-002',
        author: 'Digital Steward',
        authorRole: 'AI Claims Assistant',
        category: 'investigation',
        text: 'MDOT road maintenance log corroborates loose aggregate at I-75 SB Exit 51 on the date of loss. Evidence chain is consistent with the claimant account. Claim is eligible for straight-through repair authorisation. ADAS forward-camera recalibration must be included in the authorised repair scope — flagged with National Auto Glass Network.',
        createdAt: '2026-06-10T15:02:00Z',
      },
      {
        id: 'NOTE-ANDRE-003',
        author: 'Marcus Webb',
        authorRole: 'Senior Claims Adjuster',
        category: 'general',
        text: 'Reviewed Digital Steward assessment. Concur with straight-through eligibility. Authorising repair quote subject to ADAS recalibration inclusion. Claim should settle within 48 hours.',
        createdAt: '2026-06-11T09:15:00Z',
      },
    ];
  }
  if (name === "Patricia O'Connor") {
    return [
      {
        id: 'NOTE-PAT-001',
        author: 'Digital Steward',
        authorRole: 'AI Claims Assistant',
        category: 'general',
        text: "Masterpiece-tier client — elevated service standards apply. Claimant reported distress during FNOL. Recommended proactive communication cadence: update every 48 hours until resolution.",
        createdAt: '2026-06-05T11:20:00Z',
      },
      {
        id: 'NOTE-PAT-002',
        author: 'Sarah Kim',
        authorRole: 'Senior Claims Adjuster',
        category: 'investigation',
        text: "Brookline PD report confirmed — incident date, location, and damage description match claimant account. Damage photos consistent with low-speed impact. CCTV footage request submitted to Chestnut Hill Mall property management on 04 Jun. Awaiting response — expected within 5–7 business days. Do not proceed to settlement until footage outcome is known.",
        createdAt: '2026-06-05T14:30:00Z',
      },
      {
        id: 'NOTE-PAT-003',
        author: 'Sarah Kim',
        authorRole: 'Senior Claims Adjuster',
        category: 'legal',
        text: "If CCTV identifies responsible party, subrogation rights must be preserved — do not instruct Porsche of Brookline for repair until third-party recovery path is assessed. Advised O'Connor of timeline and explained we are pursuing identification of the responsible driver.",
        createdAt: '2026-06-05T15:10:00Z',
      },
      {
        id: 'NOTE-PAT-004',
        author: 'Digital Steward',
        authorRole: 'AI Claims Assistant',
        category: 'coverage',
        text: "Policy verification check complete: O'Connor's Masterpiece policy includes OEM-parts guarantee for vehicles under 5 years old. 2024 Porsche Cayenne S qualifies. Porsche of Brookline estimate uses OEM parts — covered. Confirmed with underwriting reference ORD-2026-MPC-4421.",
        createdAt: '2026-06-06T09:00:00Z',
      },
    ];
  }
  if (name === 'Rafael Santos') {
    return [
      {
        id: 'NOTE-RAF-001',
        author: 'Jordan Reyes',
        authorRole: 'Claims Intake Specialist',
        category: 'general',
        text: 'FNOL received via Premier AI channel at 17:55. Claimant distressed — vehicle is primary work transport. Premier service tier confirmed — 2-hour response SLA triggered. Immediate Digital Steward review initiated. Rental car arranged via Enterprise Miami, reference ENT-2026-0614-8821.',
        createdAt: '2026-06-14T18:10:00Z',
      },
      {
        id: 'NOTE-RAF-002',
        author: 'Digital Steward',
        authorRole: 'AI Claims Assistant',
        category: 'investigation',
        text: 'NOAA Flood Advisory FLA-FF-2026-0614 independently corroborates the flash-flood event at the reported parking location. Water depth 18–24 inches above kerb level consistent with reported door-sill immersion. Mercedes-Benz of Miami preliminary assessment: $14,200–$21,400. Upper range approaches total-loss threshold against ACV ~$62,000 (75% threshold = $46,500). Total-loss determination is a live question — do not authorise repair until full strip-down assessment is complete.',
        createdAt: '2026-06-14T19:30:00Z',
      },
      {
        id: 'NOTE-RAF-003',
        author: 'Lisa Fernandez',
        authorRole: 'Coverage Analyst',
        category: 'coverage',
        text: 'Policy interpretation review in progress. Key question: comprehensive peril flood exclusion. Initial read: no named flood exclusion on Santos policy — flash flood caused by weather event (not storm surge / sustained flood) is typically covered under comprehensive peril. Legal review recommended given claim value. Response due by COB 16 Jun.',
        createdAt: '2026-06-15T10:45:00Z',
      },
      {
        id: 'NOTE-RAF-004',
        author: 'Marcus Webb',
        authorRole: 'Senior Claims Adjuster',
        category: 'general',
        text: 'Instructed Mercedes-Benz of Miami to proceed with full strip-down assessment — report expected 20 Jun. Rafael Santos advised of timeline. Premier tier — managing expectations proactively. Settlement position will not be communicated until both the strip-down report and coverage review are complete.',
        createdAt: '2026-06-15T14:00:00Z',
      },
    ];
  }
  return undefined;
}

function buildAuditTrail(spec: ClaimSpec): Claim['auditTrail'] {
  const base = spec.daysAgoIncident;
  const cls = deriveClaimClass(spec);
  const cov = coverageApplicability(spec);
  const estimateStr = `$${spec.estimate.toLocaleString('en-US')}`;
  const beyondIntake = spec.stage !== 'intake';

  const trail: Claim['auditTrail'] = [
    {
      timestamp: isoDaysAgo(base, 8, 20),
      userId: 'agent_claims_intake',
      action: 'FNOL captured',
      rationale: `First notice of loss received via ${spec.intakeChannel} and validated for completeness.`,
      outcome: 'Claim created from first notice of loss',
    },
    {
      timestamp: isoDaysAgo(base, 8, 35),
      userId: spec.adjusterId,
      action: 'Adjuster assigned',
      rationale: `Routed to ${spec.adjusterName} based on claim profile and tier.`,
      outcome: `Assigned to ${spec.adjusterName}`,
    },
    {
      timestamp: isoDaysAgo(base, 9, 10),
      userId: 'agent_coverage',
      action: 'Policy verification',
      rationale: `Validated policy ${spec.claimId ? 'on record' : ''} against the reported loss and applicable clauses (${relevantClauses(spec).join('; ')}).`.replace(/\s+/g, ' ').trim(),
      outcome:
        cov === 'covered'
          ? 'Coverage confirmed — policy active and loss within terms'
          : cov === 'excluded'
          ? 'Policy reviewed — loss assessed outside coverage terms'
          : 'Policy active — coverage confirmation outstanding',
    },
    {
      timestamp: isoDaysAgo(base, 9, 25),
      userId: 'agent_siu',
      action: 'Fraud & anomaly screen',
      rationale: 'Ran SIU anomaly model across claim history, network links and incident signals.',
      outcome: spec.fraud
        ? 'Anomaly detected — referred to SIU for investigation'
        : 'No anomaly signals — fraud screen passed',
    },
  ];

  if (spec.estimate > 0) {
    trail.push({
      timestamp: isoDaysAgo(base, 10, 0),
      userId: 'agent_damage',
      action: cls === 'glass' ? 'Glass replacement quote' : 'Damage assessment & repair quote',
      rationale:
        cls === 'glass'
          ? 'Sourced replacement quote from the approved national glass network.'
          : 'Assessed damage from submitted evidence and sourced a repair quote from the approved network.',
      outcome: `Repair quote received and verified — ${estimateStr} estimated`,
    });
  }

  if (beyondIntake) {
    trail.push({
      timestamp: isoDaysAgo(base, 10, 20),
      userId: 'agent_steward',
      action: 'AI recommendation generated',
      rationale: `Synthesised coverage, evidence and exposure into a recommended action at ${spec.confidence} confidence.`,
      outcome: `Recommendation prepared for adjuster review at ${spec.confidence} confidence`,
    });
  }

  if (spec.stage === 'closed') {
    trail.push({
      timestamp: isoDaysAgo(Math.max(base - 3, 0), 16, 30),
      userId: 'agent_claims_settlement',
      action: spec.outcome === 'denied' ? 'Claim denied' : 'Settlement paid',
      rationale:
        spec.outcome === 'denied'
          ? 'Loss outside policy terms.'
          : `Settlement of $${spec.estimate.toLocaleString('en-US')} approved and paid.`,
      outcome: 'Claim closed',
    });
  }

  return trail;
}

// Augment spec with a vehicle label used in evidence text.
interface ClaimSpec {
  vehicleLabel?: string;
}

function buildClaim(spec: ClaimSpec): Claim {
  const roster = ROSTER[spec.claimant];
  const tier = roster.tier;
  spec.vehicleLabel = roster.vehicle;

  const parties: Array<{ name: string; role: string }> = [{ name: roster.name, role: 'Claimant Driver' }];
  if (spec.thirdParty) parties.push({ name: spec.thirdParty, role: 'Third Party Driver' });

  const createdAt = isoDaysAgo(spec.daysAgoIncident, 8, 15);
  const updatedAt = spec.stage === 'closed' ? isoDaysAgo(Math.max(spec.daysAgoIncident - 4, 0), 17, 0) : isoHoursAgo(2);

  return {
    id: spec.claimId,
    claimantName: roster.name,
    claimantEmail: roster.email,
    claimantPhone: roster.phone,
    incidentType: 'Auto',
    incidentDate: isoDaysAgo(spec.daysAgoIncident, 8, 0).slice(0, 10),
    incidentTime: spec.fraud ? '23:40' : '08:15',
    incidentLocation: spec.incidentLocation,
    partiesInvolved: parties,
    injuryIndicated: spec.injury,
    immediateNeeds: spec.injury
      ? ['Medical Support', 'Rental Vehicle']
      : deriveClaimClass(spec) === 'glass'
      ? tier === 'signature' || tier === 'white_glove'
        ? ['Concierge Glass Replacement', 'Courtesy Vehicle']
        : ['Mobile Glass Replacement']
      : ['Vehicle Repair', 'Rental Vehicle'],
    preferredContactChannel: 'Phone',
    incidentDescription: spec.description,
    intakeChannel: spec.intakeChannel,

    policyRef: roster.policyRef,
    policyContext: {
      policyNumber: roster.policyRef,
      coverageType: roster.coverageType,
      relevantClauses: relevantClauses(spec),
      coverageApplicability: coverageApplicability(spec),
      ambiguityIndicators:
        coverageApplicability(spec) === 'ambiguous'
          ? spec.fraud
            ? ['Fraud signals unresolved']
            : ['Coverage confirmation outstanding']
          : undefined,
    },

    claimStage: spec.stage,
    pendingDecisionType: spec.decisionType,
    blockerReason: blockerForStage(spec),
    confidenceLevel: spec.confidence,
    complexity: spec.complexity,
    lastAgentAction: lastActionForStage(spec),
    timeInQueue: spec.queueAge,
    priority: spec.priority,
    owner: spec.adjusterName,
    claimantPersonaId: roster.personaId,
    assignedAdjusterId: spec.adjusterId,
    assignedAdjusterName: spec.adjusterName,
    clientServiceTier: tier,
    handlingMode: handlingModeForTier(tier),
    // Straight-through (agent auto-finalise) is confined to clean glass-only losses.
    straightThroughEligible: deriveClaimClass(spec) === 'glass' && spec.outcome !== 'denied',

    narrativeSynthesis: buildNarrative(spec),
    anomalySignals: buildAnomalies(spec),
    evidenceItems: buildEvidence(spec),
    recommendedAction: buildRecommendedAction(spec, 'Settlement Calculation Agent'),

    auditTrail: buildAuditTrail(spec),
    claimNotes: buildClaimNotes(spec),
    createdAt,
    updatedAt,
  };
}

// ── AI confidence assessment ─────────────────────────────────────────────────

/**
 * Extract the signals the LLM needs to assess a claim's confidence score.
 * Keeps the prompt concise — only facts, no raw JSON blobs.
 */
function claimToSignals(claim: Claim): ClaimConfidenceSignals {
  const narrative = claim.narrativeSynthesis ?? [];
  const confirmed = narrative.filter((n) => n.status === 'Confirmed').length;
  const inferred = narrative.filter((n) => n.status === 'Inferred').length;
  const pending = narrative.filter((n) => n.status === 'Pending').length;
  const disputed = narrative.filter((n) => n.status === 'Disputed').length;

  const evidence = claim.evidenceItems ?? [];
  const verified = evidence.filter((e) => e.status === 'verified').length;
  const pendingEv = evidence.filter((e) => e.status === 'pending').length;
  const disputedEv = evidence.filter((e) => e.status === 'disputed').length;

  const anomalies = claim.anomalySignals ?? [];
  const anomalySummary =
    anomalies.length === 0
      ? 'none'
      : anomalies.map((a) => `${a.severity}-severity ${a.type}`).join(', ');

  return {
    claimId: claim.id,
    incidentType: claim.incidentType,
    complexity: claim.complexity,
    stage: claim.claimStage,
    coverageApplicability: claim.policyContext?.coverageApplicability ?? 'unknown',
    straightThroughEligible: claim.straightThroughEligible ?? false,
    injuryIndicated: claim.injuryIndicated,
    narrativeSummary: `${confirmed} confirmed, ${inferred} inferred, ${pending} pending, ${disputed} disputed (${narrative.length} total)`,
    evidenceSummary: `${verified} verified, ${pendingEv} pending, ${disputedEv} disputed (${evidence.length} total)`,
    anomalySummary,
    estimatedAmount: claim.recommendedAction?.financialImpact?.estimatedAmount ?? 0,
  };
}

/**
 * Call Foundry AI in parallel batches to score every claim in the portfolio.
 * Returns a map of claimId → { score, rationale }. Failures are logged and
 * skipped — the claim record simply won't have an aiConfidenceScore, and the
 * frontend falls back to the formula-computed value.
 */
async function batchAssessConfidence(
  claims: Claim[],
): Promise<Map<string, { score: number; rationale: string }>> {
  const ai = AIProviderFactory.create();
  const results = new Map<string, { score: number; rationale: string }>();
  const BATCH = 5;

  for (let i = 0; i < claims.length; i += BATCH) {
    const batch = claims.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(async (c) => {
        const r = await ai.assessClaimConfidence(claimToSignals(c));
        return { id: c.id, ...r };
      }),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.id, { score: result.value.score, rationale: result.value.rationale });
      } else {
        console.warn('[seeder] AI confidence assessment failed for a claim:', result.reason?.message ?? result.reason);
      }
    }
  }
  return results;
}

// ── Telemetry (real agents when deployed, realistic mock otherwise) ──────────

function isAgentDeployed(agent: Agent | undefined): boolean {
  return Boolean(agent && (agent.deploymentId || agent.deploymentEndpoint || agent.deployedAt));
}

interface TelemetryStep {
  agentId: string;
  interactionType:
    | 'fnol_submit'
    | 'agent_test'
    | 'steward_chat';
  user: string;
  assistant: string;
  ratePer1k: number;
  escalated?: boolean;
  realQuery?: string;
}

function stepsForClaim(spec: ClaimSpec): TelemetryStep[] {
  const roster = ROSTER[spec.claimant];
  const steps: TelemetryStep[] = [
    {
      agentId: 'agent_claims_intake',
      interactionType: 'fnol_submit',
      user: `FNOL captured for ${spec.scenarioTitle.toLowerCase()} (${spec.claimId}).`,
      assistant: `Intake complete; claim ${spec.claimId} created and routed for coverage verification.`,
      ratePer1k: 0.016,
      realQuery: `A claimant reports: "${spec.description}" Summarise the first notice of loss and list the next intake step.`,
    },
    {
      agentId: 'agent_claims_policy_verification',
      interactionType: 'agent_test',
      user: `Verify coverage for ${spec.claimId} under ${roster.policyRef}.`,
      assistant:
        coverageApplicability(spec) === 'excluded'
          ? 'Coverage review indicates the loss falls outside policy terms.'
          : coverageApplicability(spec) === 'ambiguous'
            ? 'Coverage likely applies; confirmation of one clause still outstanding.'
            : 'Active coverage confirmed for the reported peril.',
      ratePer1k: 0.014,
    },
  ];

  if (spec.fraud) {
    steps.push({
      agentId: 'agent_claims_fraud',
      interactionType: 'agent_test',
      user: `Assess fraud indicators for ${spec.claimId}.`,
      assistant: 'High-severity staging indicators detected; referred to SIU with reserve held.',
      ratePer1k: 0.02,
      escalated: true,
    });
  }

  steps.push({
    agentId: 'digital-steward',
    interactionType: 'steward_chat',
    user: `Review governance and assignment for ${spec.claimId} (${spec.priority} priority).`,
    assistant:
      spec.fraud || spec.priority === 'urgent'
        ? 'Governance check: high-risk claim correctly escalated; senior oversight applied.'
        : 'Governance check passed; assignment and handling mode align with client tier.',
    ratePer1k: 0.018,
    escalated: spec.fraud,
  });

  if (spec.stage === 'settlement' || spec.stage === 'closed') {
    steps.push({
      agentId: 'agent_claims_settlement',
      interactionType: 'agent_test',
      user: `Produce settlement valuation for ${spec.claimId}.`,
      assistant:
        spec.outcome === 'denied'
          ? 'No settlement; claim recommended for denial as not covered.'
          : `Settlement valued at $${spec.estimate.toLocaleString('en-US')} and ${spec.stage === 'closed' ? 'paid.' : 'prepared for approval.'}`,
      ratePer1k: 0.015,
    });
  }

  return steps;
}

async function emitClaimTelemetry(
  spec: ClaimSpec,
  deployedAgentIds: Set<string>,
  useRealAgents: boolean,
): Promise<{ emitted: number; realCalls: number }> {
  const rnd = mulberry32(hashSeed(spec.claimId));
  const roster = ROSTER[spec.claimant];
  const steps = stepsForClaim(spec);
  let realCalls = 0;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const inputTokens = randomInt(420, 2200, rnd);
    let outputTokens = randomInt(160, 1050, rnd);
    let assistant = step.assistant;
    let confidence =
      spec.confidence === 'high' ? 0.9 - rnd() * 0.06 : spec.confidence === 'medium' ? 0.74 - rnd() * 0.08 : 0.55 - rnd() * 0.1;
    let usedReal = false;

    const deployed = deployedAgentIds.has(step.agentId);
    if (useRealAgents && deployed && step.realQuery) {
      try {
        const result = await Promise.race([
          testDeployedAgent(`foundry-${step.agentId}`, step.realQuery, [], { context: 'orchestrated' }),
          new Promise<{ success: false; message: string }>((resolve) =>
            setTimeout(() => resolve({ success: false, message: 'timeout' }), 20000),
          ),
        ]);
        if ('success' in result && result.success && result.response) {
          assistant = result.response.slice(0, 1200);
          if (typeof result.confidence === 'number') confidence = result.confidence;
          outputTokens = Math.max(80, Math.round(assistant.length / 4));
          usedReal = true;
          realCalls += 1;
        }
      } catch {
        // fall back to mock content already set
      }
    }

    const estimatedCostUsd = Number((((inputTokens + outputTokens) / 1000) * step.ratePer1k).toFixed(6));

    recordInteraction({
      agentId: step.agentId,
      sessionId: `seed-${spec.claimId}`,
      claimId: spec.claimId,
      callerId: roster.name,
      interactionType: step.interactionType,
      userContent: step.user,
      assistantContent: assistant,
      confidence: Number(confidence.toFixed(3)),
      escalated: Boolean(step.escalated),
      inputTokens,
      outputTokens,
      meta: {
        durationMs: randomInt(700, 3800, rnd),
        estimatedCostUsd,
        seededAsset: true,
        executionMode: usedReal ? 'deployed-agent' : deployed ? 'mock-of-deployed' : 'mock',
        mockedAgentExecution: !usedReal,
        claimStage: spec.stage,
        scenario: spec.scenarioTitle,
        clientTier: roster.tier,
        toolCalls: [{ name: 'coverage-lookup', success: true }],
      },
    });
  }

  return { emitted: steps.length, realCalls };
}

// ── Public API ────────────────────────────────────────────────────────────

async function ensureContainers(): Promise<boolean> {
  const ready = await Promise.all([
    claimsRepo.ensureContainer('/id'),
    policiesRepo.ensureContainer('/id'),
    personasRepo.ensureContainer('/id'),
    suiteRepo.ensureContainer('/id'),
    caseRepo.ensureContainer('/suiteId'),
    runRepo.ensureContainer('/suiteId'),
    evalRepo.ensureContainer('/suiteId'),
    fnolSessionsRepo.ensureContainer('/id'),
  ]);
  return ready.every(Boolean);
}

async function resolveDeployedClaimsAgents(): Promise<Set<string>> {
  const deployed = new Set<string>();
  try {
    const agents = await agentService.getAll();
    const byId = new Map(agents.map((a) => [a.id, a]));
    for (const id of [
      'agent_claims_intake',
      'agent_claims_policy_verification',
      'agent_claims_fraud',
      'agent_claims_settlement',
      'digital-steward',
    ]) {
      if (isAgentDeployed(byId.get(id))) deployed.add(id);
    }
  } catch {
    // No agents available — everything mocks.
  }
  return deployed;
}

export interface ReseedResult {
  claimsDeleted: number;
  claimsCreated: number;
  telemetryDeleted: number;
  telemetryEmitted: number;
  realAgentCalls: number;
  policiesDeleted: number;
  personasDeleted: number;
}

/**
 * Full reset: wipe everything except Richard Hogan, then rebuild the curated
 * production dataset and emit agent telemetry for every claim.
 */
export async function reseedClaimDemoData(
  options: { useRealAgents?: boolean } = {},
): Promise<ReseedResult> {
  const useRealAgents = options.useRealAgents === true;
  if (!(await ensureContainers())) {
    throw new Error('Cosmos DB is not available — cannot reseed claim demo data.');
  }

  // 1. Wipe (preserve only Richard's persona + policies).
  const [claims, policies, personas, suites, cases, runs, evals, fnolSessions] = await Promise.all([
    claimsRepo.findAll(),
    policiesRepo.findAll(),
    personasRepo.findAll(),
    suiteRepo.findAll(),
    caseRepo.findAll(),
    runRepo.findAll(),
    evalRepo.findAll(),
    fnolSessionsRepo.findAll(),
  ]);

  const policiesToDelete = policies.filter((p) => {
    const holder = (p.holderName ?? '').trim().toLowerCase();
    return p.personaId !== RICHARD_PERSONA_ID && holder !== RICHARD_HOLDER_NAME;
  });
  const personasToDelete = personas.filter((p) => p.id !== RICHARD_PERSONA_ID);

  const telemetryDeletedPromise = clearAllInteractions();
  await Promise.all([
    Promise.all(claims.map((d) => claimsRepo.delete(d.id))),
    Promise.all(policiesToDelete.map((d) => policiesRepo.delete(d.id))),
    Promise.all(personasToDelete.map((d) => personasRepo.delete(d.id))),
    Promise.all(suites.map((d) => suiteRepo.delete(d.id))),
    Promise.all(cases.map((d) => caseRepo.delete(d.id))),
    Promise.all(runs.map((d) => runRepo.delete(d.id))),
    Promise.all(evals.map((d) => evalRepo.delete(d.id))),
    Promise.all(fnolSessions.map((d) => fnolSessionsRepo.delete(d.id))),
  ]);
  const telemetryDeleted = await telemetryDeletedPromise.catch(() => 0);

  // 2. Restore production personas + policies (idempotent; re-creates the 6 US personas).
  await syncCustomerPersonaData();

  // 3. Build + score + upsert curated claims, and emit telemetry per claim.
  const deployedAgents = await resolveDeployedClaimsAgents();
  let telemetryEmitted = 0;
  let realAgentCalls = 0;

  // Build all claims first so we can batch-score them with the Foundry AI
  // before writing to Cosmos. This ensures aiConfidenceScore is set on every
  // claim record from day one (no lazy enrichment needed).
  const builtClaims = CLAIM_SPECS.map(buildClaim);

  console.log('[seeder] Requesting AI confidence scores for', builtClaims.length, 'claims…');
  const confidenceMap = await batchAssessConfidence(builtClaims);
  console.log('[seeder] AI confidence scored', confidenceMap.size, 'of', builtClaims.length, 'claims');

  for (let idx = 0; idx < CLAIM_SPECS.length; idx++) {
    const spec = CLAIM_SPECS[idx];
    const claim = builtClaims[idx];
    const aiResult = confidenceMap.get(claim.id);
    if (aiResult) {
      claim.aiConfidenceScore = aiResult.score;
      claim.aiConfidenceRationale = aiResult.rationale;
    }
    await claimsRepo.upsert(claim);
    const t = await emitClaimTelemetry(spec, deployedAgents, useRealAgents);
    telemetryEmitted += t.emitted;
    realAgentCalls += t.realCalls;
  }

  // 4. Re-link personas to the new claims and recompute adjuster workloads.
  await syncCustomerPersonaData();
  await syncAdjusterDemoData({ seedDemoClaims: false });

  return {
    claimsDeleted: claims.length,
    claimsCreated: CLAIM_SPECS.length,
    telemetryDeleted,
    telemetryEmitted,
    realAgentCalls,
    policiesDeleted: policiesToDelete.length,
    personasDeleted: personasToDelete.length,
  };
}

/**
 * Idempotent startup seed: if the curated claims are missing, seed them (and
 * their telemetry) without wiping anything. Safe to call on every startup.
 */
export async function ensureClaimDemoData(): Promise<{ seeded: boolean; claimsCreated: number }> {
  if (!(await ensureContainers())) return { seeded: false, claimsCreated: 0 };

  const marker = await claimsRepo.findById(CLAIM_SPECS[0].claimId).catch(() => null);
  if (marker) return { seeded: false, claimsCreated: 0 };

  const deployedAgents = await resolveDeployedClaimsAgents();
  for (const spec of CLAIM_SPECS) {
    await claimsRepo.upsert(buildClaim(spec));
    await emitClaimTelemetry(spec, deployedAgents, false);
  }
  return { seeded: true, claimsCreated: CLAIM_SPECS.length };
}

export const CURATED_CLAIM_IDS = CLAIM_SPECS.map((s) => s.claimId);
