import { CosmosRepository } from './cosmosRepository';
import type { Claim, CustomerPersona, ClientServiceTier, AppointedRepresentative } from '../types';
import type { Policy } from './policyService';

const personaRepo = new CosmosRepository<CustomerPersona>('customer-personas');
const claimsRepo = new CosmosRepository<Claim>('claims');
const policiesRepo = new CosmosRepository<Policy>('policies');

type SeededPersona = Omit<CustomerPersona, 'policyRefs' | 'currentClaimIds' | 'priorClaimIds' | 'supportSummary'> & {
  policyRefs?: string[];
  currentClaimIds?: string[];
  priorClaimIds?: string[];
  supportSummary?: CustomerPersona['supportSummary'];
  policies: Policy[];
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function isBusinessName(name: string): boolean {
  return /\b(llc|inc|ltd|corp|corporation|group|holdings|logistics|transport)\b/i.test(name);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function summarizePolicies(policies: Policy[]): CustomerPersona['supportSummary'] {
  return {
    policyCount: policies.length,
    activeClaimCount: 0,
    totalAnnualPremium: policies.reduce((sum, policy) => sum + (policy.annualPremium ?? 0), 0),
    claimFreeYears: policies.length ? Math.max(...policies.map((policy) => policy.noClaims ?? 0)) : 0,
  };
}

function makePolicy(personaId: string, policy: Omit<Policy, 'id' | 'personaId'>): Policy {
  return {
    ...policy,
    id: policy.policyRef,
    personaId,
  };
}

const SELECTABLE_PERSONAS: SeededPersona[] = [
  {
    id: 'cust_richard_hogan',
    displayName: 'Richard Hogan',
    serviceTier: 'signature',
    appointedRepresentative: {
      firmName: 'Meridian Private Client Partners',
      contactName: 'Jonathan Caldwell',
      relationship: 'Appointed Representative',
    },
    firstName: 'Richard',
    lastName: 'Hogan',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/Los_Angeles',
    email: 'richard.hogan@baneox-demo.com',
    phone: '+1-206-555-0148',
    preferredContactChannel: 'Phone',
    addressLine1: '1246 Magnolia Ridge Drive',
    city: 'Bellevue',
    state: 'WA',
    postalCode: '98004',
    customerSince: '2018-03-14',
    occupation: 'Managing Partner, Private Capital Advisory',
    household: 'Married, two collegiate drivers; primary residence plus seasonal lake property',
    defaultPolicyRef: 'POL-AUTO-US-2026-RH01',
    notes: ['Prefers fast claim updates by text after the first call.', 'Keeps dashcam footage for every family vehicle.', 'Assigned a dedicated Chubb claims relationship manager.'],
    riskSignals: ['Collegiate driver on household schedule', 'Agreed-value collector vehicle', 'Scheduled fine art & jewelry on valuables line'],
    profileNote: 'High-net-worth Masterpiece household: agreed-value auto, extended-replacement-cost home, layered excess liability, and scheduled valuables. White-glove service expectations.',
    policies: [
      makePolicy('cust_richard_hogan', {
        policyRef: 'POL-AUTO-US-2026-RH01',
        policyType: 'Auto',
        holderName: 'Richard Hogan',
        holderDob: '1982-04-19',
        holderEmail: 'richard.hogan@baneox-demo.com',
        holderPhone: '+1-206-555-0148',
        address: '1246 Magnolia Ridge Drive, Bellevue, WA 98004',
        coverageType: 'Chubb Masterpiece Auto — Agreed Value, Full Coverage (Liability, Collision, Comprehensive), OEM repair & original-parts guarantee',
        coverageActive: true,
        startDate: '2026-01-01',
        renewalDate: '2027-01-01',
        annualPremium: 9420,
        excessAmount: 1000,
        noClaims: 6,
        vehicles: [
          { make: 'Land Rover', model: 'Range Rover Autobiography', registration: 'BXR-4186', year: 2024, colour: 'Santorini Black', value: 142000 },
          { make: 'Porsche', model: '911 Carrera 4S', registration: 'WAE-2461', year: 2023, colour: 'GT Silver', value: 138500 },
          { make: 'Mercedes-Benz', model: '280SL Pagoda (Collector, Agreed Value)', registration: 'RH-280SL', year: 1969, colour: 'Papyrus White', value: 185000 },
        ],
        namedDrivers: ['Richard Hogan', 'Claire Hogan', 'Owen Hogan'],
        connectedDevices: {
          dashcam: { manufacturer: 'Garmin', model: 'Dash Cam Live', registeredApp: 'Garmin Drive', vehicleReg: 'BXR-4186' },
          telematics: { provider: 'Progressive Snapshot', vehicleReg: 'WAE-2461', appName: 'Snapshot' },
        },
        notes: 'Masterpiece bundled household account. Agreed-value collector vehicle, OEM repair guarantee, rental reimbursement (luxury class) and roadside assistance both active.',
      }),
      makePolicy('cust_richard_hogan', {
        policyRef: 'POL-HOME-US-2026-RH01',
        policyType: 'Homeowners',
        holderName: 'Richard Hogan',
        holderEmail: 'richard.hogan@baneox-demo.com',
        holderPhone: '+1-206-555-0148',
        address: '1246 Magnolia Ridge Drive, Bellevue, WA 98004',
        coverageType: 'Chubb Masterpiece Homeowners (HO-5) — Extended Replacement Cost, cash-settlement option',
        coverageActive: true,
        startDate: '2026-01-01',
        renewalDate: '2027-01-01',
        annualPremium: 8240,
        excessAmount: 5000,
        noClaims: 6,
        buildingsValue: 2650000,
        contentsValue: 925000,
        notes: 'Extended replacement cost dwelling, water backup endorsement active, smart leak sensors registered. Cash-settlement option available.',
      }),
      makePolicy('cust_richard_hogan', {
        policyRef: 'POL-UMB-US-2026-RH01',
        policyType: 'Personal Umbrella',
        holderName: 'Richard Hogan',
        holderEmail: 'richard.hogan@baneox-demo.com',
        holderPhone: '+1-206-555-0148',
        address: '1246 Magnolia Ridge Drive, Bellevue, WA 98004',
        coverageType: 'Chubb $10M Personal Excess Liability (Umbrella)',
        coverageActive: true,
        startDate: '2026-01-01',
        renewalDate: '2027-01-01',
        annualPremium: 1850,
        excessAmount: 0,
        noClaims: 6,
        notes: '$10M excess liability layered over auto and home, including uninsured/underinsured motorist excess.',
      }),
      makePolicy('cust_richard_hogan', {
        policyRef: 'POL-VAL-US-2026-RH01',
        policyType: 'Valuable Articles',
        holderName: 'Richard Hogan',
        holderEmail: 'richard.hogan@baneox-demo.com',
        holderPhone: '+1-206-555-0148',
        address: '1246 Magnolia Ridge Drive, Bellevue, WA 98004',
        coverageType: 'Chubb Masterpiece Valuable Articles — Scheduled fine art, jewelry & wine (agreed value, worldwide, no deductible)',
        coverageActive: true,
        startDate: '2026-01-01',
        renewalDate: '2027-01-01',
        annualPremium: 3650,
        excessAmount: 0,
        noClaims: 6,
        contentsValue: 480000,
        notes: 'Scheduled items: fine art ($265K), jewelry ($140K), wine collection ($75K). Agreed value, worldwide coverage, breakage included.',
      }),
    ],
  },
  {
    id: 'cust_maya_thompson',
    displayName: 'Maya Thompson',
    serviceTier: 'standard',
    firstName: 'Maya',
    lastName: 'Thompson',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/Chicago',
    email: 'maya.thompson@baneox-demo.com',
    phone: '+1-512-555-0127',
    preferredContactChannel: 'SMS',
    addressLine1: '8714 Loma Vista Trail',
    city: 'Austin',
    state: 'TX',
    postalCode: '78738',
    customerSince: '2021-08-03',
    occupation: 'UX Design Lead',
    household: 'Single driver, frequent rideshare and airport mileage',
    defaultPolicyRef: 'POL-AUTO-US-2026-MT01',
    notes: ['Usually uploads photos immediately from the scene.', 'Prefers concise updates and same-day claim status pings.'],
    riskSignals: ['High urban commuting mileage', 'Frequent airport parking exposure'],
    profileNote: 'Connected-device heavy auto customer with renters coverage and strong mobile adoption.',
    policies: [
      makePolicy('cust_maya_thompson', {
        policyRef: 'POL-AUTO-US-2026-MT01',
        policyType: 'Auto',
        holderName: 'Maya Thompson',
        holderDob: '1991-09-11',
        holderEmail: 'maya.thompson@baneox-demo.com',
        holderPhone: '+1-512-555-0127',
        address: '8714 Loma Vista Trail, Austin, TX 78738',
        coverageType: 'Full Coverage Auto — Liability, Collision, Comprehensive',
        coverageActive: true,
        startDate: '2026-02-01',
        renewalDate: '2027-02-01',
        annualPremium: 1985,
        excessAmount: 750,
        noClaims: 4,
        vehicles: [{ make: 'Subaru', model: 'Outback Touring XT', registration: 'TQF-6204', year: 2024, colour: 'Autumn Green', value: 43800 }],
        namedDrivers: ['Maya Thompson'],
        connectedDevices: {
          dashcam: { manufacturer: 'Nextbase', model: '622GW', registeredApp: 'MyNextbase Connect', vehicleReg: 'TQF-6204' },
          telematics: { provider: 'Drivewise', vehicleReg: 'TQF-6204', appName: 'Drivewise' },
        },
        notes: 'Rental reimbursement and glass coverage active.',
      }),
      makePolicy('cust_maya_thompson', {
        policyRef: 'POL-RENT-US-2026-MT01',
        policyType: 'Renters',
        holderName: 'Maya Thompson',
        holderEmail: 'maya.thompson@baneox-demo.com',
        holderPhone: '+1-512-555-0127',
        address: '8714 Loma Vista Trail, Austin, TX 78738',
        coverageType: 'Renters HO-4',
        coverageActive: true,
        startDate: '2026-02-01',
        renewalDate: '2027-02-01',
        annualPremium: 245,
        excessAmount: 500,
        noClaims: 4,
        contentsValue: 72000,
        notes: 'Home office equipment rider active.',
      }),
    ],
  },
  {
    id: 'cust_carlos_ramirez',
    displayName: 'Carlos Ramirez',
    serviceTier: 'priority',
    firstName: 'Carlos',
    lastName: 'Ramirez',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/Phoenix',
    email: 'carlos.ramirez@baneox-demo.com',
    phone: '+1-602-555-0119',
    preferredContactChannel: 'Phone',
    addressLine1: '3190 Desert Crest Court',
    city: 'Phoenix',
    state: 'AZ',
    postalCode: '85016',
    customerSince: '2016-05-22',
    occupation: 'General Contractor',
    household: 'Married with one college-age named driver',
    defaultPolicyRef: 'POL-AUTO-US-2026-CR01',
    notes: ['Often calls from job sites and wants quick next steps.', 'Usually has photos but not always third-party insurance details.'],
    riskSignals: ['Pickup used for towing equipment', 'High summer hail exposure'],
    profileNote: 'Bundle customer with truck-heavy use and homeowners line.',
    policies: [
      makePolicy('cust_carlos_ramirez', {
        policyRef: 'POL-AUTO-US-2026-CR01',
        policyType: 'Auto',
        holderName: 'Carlos Ramirez',
        holderDob: '1984-02-17',
        holderEmail: 'carlos.ramirez@baneox-demo.com',
        holderPhone: '+1-602-555-0119',
        address: '3190 Desert Crest Court, Phoenix, AZ 85016',
        coverageType: 'Auto — Liability, Collision, Comprehensive, Rental',
        coverageActive: true,
        startDate: '2026-03-01',
        renewalDate: '2027-03-01',
        annualPremium: 2245,
        excessAmount: 1000,
        noClaims: 5,
        vehicles: [{ make: 'Ford', model: 'F-150 Lariat', registration: 'AZM-7318', year: 2023, colour: 'Oxford White', value: 56400 }],
        namedDrivers: ['Carlos Ramirez', 'Elena Ramirez', 'Nico Ramirez'],
        connectedDevices: {
          telematics: { provider: 'FordPass Connect', vehicleReg: 'AZM-7318', appName: 'FordPass' },
        },
        notes: 'Tow package and contractor tools endorsement noted.',
      }),
      makePolicy('cust_carlos_ramirez', {
        policyRef: 'POL-HOME-US-2026-CR01',
        policyType: 'Homeowners',
        holderName: 'Carlos Ramirez',
        holderEmail: 'carlos.ramirez@baneox-demo.com',
        holderPhone: '+1-602-555-0119',
        address: '3190 Desert Crest Court, Phoenix, AZ 85016',
        coverageType: 'Homeowners HO-3',
        coverageActive: true,
        startDate: '2026-03-01',
        renewalDate: '2027-03-01',
        annualPremium: 1470,
        excessAmount: 2500,
        noClaims: 5,
        buildingsValue: 640000,
        contentsValue: 185000,
        notes: 'Roof surfacing updated 2024. Separate tool trailer insured commercially elsewhere.',
      }),
    ],
  },
  {
    id: 'cust_danielle_brooks',
    displayName: 'Danielle Brooks',
    serviceTier: 'priority',
    firstName: 'Danielle',
    lastName: 'Brooks',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/New_York',
    email: 'danielle.brooks@baneox-demo.com',
    phone: '+1-704-555-0183',
    preferredContactChannel: 'Phone',
    addressLine1: '6427 Crescent Harbor Way',
    city: 'Charlotte',
    state: 'NC',
    postalCode: '28277',
    customerSince: '2020-11-09',
    occupation: 'Regional Sales Manager',
    household: 'Two-vehicle household, frequent interstate travel',
    defaultPolicyRef: 'POL-AUTO-US-2026-DB01',
    notes: ['Wants a human callback if liability looks disputed.', 'Usually provides detailed third-party contact information.'],
    riskSignals: ['Frequent interstate mileage', 'Company reimbursement use but personal policy'],
    profileNote: 'Travel-heavy household with bundled umbrella protection and strong documentation habits.',
    policies: [
      makePolicy('cust_danielle_brooks', {
        policyRef: 'POL-AUTO-US-2026-DB01',
        policyType: 'Auto',
        holderName: 'Danielle Brooks',
        holderDob: '1988-07-02',
        holderEmail: 'danielle.brooks@baneox-demo.com',
        holderPhone: '+1-704-555-0183',
        address: '6427 Crescent Harbor Way, Charlotte, NC 28277',
        coverageType: 'Auto — Liability, Collision, Comprehensive, Uninsured Motorist',
        coverageActive: true,
        startDate: '2026-04-01',
        renewalDate: '2027-04-01',
        annualPremium: 2110,
        excessAmount: 750,
        noClaims: 7,
        vehicles: [
          { make: 'Acura', model: 'MDX Advance', registration: 'NCK-2745', year: 2024, colour: 'Liquid Carbon', value: 61800 },
          { make: 'Honda', model: 'Accord Touring Hybrid', registration: 'ZNP-4607', year: 2023, colour: 'Meteorite Gray', value: 36700 },
        ],
        namedDrivers: ['Danielle Brooks', 'Marcus Brooks'],
        connectedDevices: {
          dashcam: { manufacturer: 'Thinkware', model: 'U3000', registeredApp: 'Thinkware Connected', vehicleReg: 'NCK-2745' },
        },
        notes: 'Roadside assistance and OEM parts endorsement active.',
      }),
      makePolicy('cust_danielle_brooks', {
        policyRef: 'POL-UMB-US-2026-DB01',
        policyType: 'Personal Umbrella',
        holderName: 'Danielle Brooks',
        holderEmail: 'danielle.brooks@baneox-demo.com',
        holderPhone: '+1-704-555-0183',
        address: '6427 Crescent Harbor Way, Charlotte, NC 28277',
        coverageType: '$1M Personal Umbrella',
        coverageActive: true,
        startDate: '2026-04-01',
        renewalDate: '2027-04-01',
        annualPremium: 320,
        excessAmount: 0,
        noClaims: 7,
        notes: 'Sits above auto and home policies.',
      }),
    ],
  },
  {
    id: 'cust_renee_walker',
    displayName: 'Renee Walker',
    serviceTier: 'standard',
    firstName: 'Renee',
    lastName: 'Walker',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/Denver',
    email: 'renee.walker@baneox-demo.com',
    phone: '+1-303-555-0176',
    preferredContactChannel: 'SMS',
    addressLine1: '1521 Juniper Bend',
    city: 'Denver',
    state: 'CO',
    postalCode: '80211',
    customerSince: '2019-06-17',
    occupation: 'Pediatric Nurse Practitioner',
    household: 'Single homeowner with ski-season travel',
    defaultPolicyRef: 'POL-AUTO-US-2026-RW01',
    notes: ['Usually submits telematics consent quickly.', 'Prefers text updates during work shifts.'],
    riskSignals: ['Winter weather exposure', 'Mountain highway travel'],
    profileNote: 'Low-claim customer with connected SUV and homeowners coverage in a weather-exposed region.',
    policies: [
      makePolicy('cust_renee_walker', {
        policyRef: 'POL-AUTO-US-2026-RW01',
        policyType: 'Auto',
        holderName: 'Renee Walker',
        holderDob: '1986-12-27',
        holderEmail: 'renee.walker@baneox-demo.com',
        holderPhone: '+1-303-555-0176',
        address: '1521 Juniper Bend, Denver, CO 80211',
        coverageType: 'Auto — Liability, Collision, Comprehensive',
        coverageActive: true,
        startDate: '2026-01-15',
        renewalDate: '2027-01-15',
        annualPremium: 1765,
        excessAmount: 1000,
        noClaims: 8,
        vehicles: [{ make: 'Toyota', model: '4Runner Limited', registration: 'COH-8152', year: 2022, colour: 'Magnetic Gray', value: 46800 }],
        namedDrivers: ['Renee Walker'],
        connectedDevices: {
          telematics: { provider: 'Milewise', vehicleReg: 'COH-8152', appName: 'Milewise' },
        },
        notes: 'Snow-tire reimbursement endorsement active.',
      }),
      makePolicy('cust_renee_walker', {
        policyRef: 'POL-HOME-US-2026-RW01',
        policyType: 'Homeowners',
        holderName: 'Renee Walker',
        holderEmail: 'renee.walker@baneox-demo.com',
        holderPhone: '+1-303-555-0176',
        address: '1521 Juniper Bend, Denver, CO 80211',
        coverageType: 'Homeowners HO-5',
        coverageActive: true,
        startDate: '2026-01-15',
        renewalDate: '2027-01-15',
        annualPremium: 1395,
        excessAmount: 2500,
        noClaims: 8,
        buildingsValue: 715000,
        contentsValue: 210000,
        notes: 'Water backup and sports equipment rider active.',
      }),
    ],
  },
  {
    id: 'cust_ethan_park',
    displayName: 'Ethan Park',
    serviceTier: 'standard',
    firstName: 'Ethan',
    lastName: 'Park',
    entityType: 'individual',
    selectable: true,
    locale: 'en-US',
    timeZone: 'America/New_York',
    email: 'ethan.park@baneox-demo.com',
    phone: '+1-614-555-0133',
    preferredContactChannel: 'Phone',
    addressLine1: '907 Keswick Lane',
    city: 'Columbus',
    state: 'OH',
    postalCode: '43085',
    customerSince: '2022-09-30',
    occupation: 'Software Engineer',
    household: 'Single driver with weekend track-day exclusions explained on file',
    defaultPolicyRef: 'POL-AUTO-US-2026-EP01',
    notes: ['Understands app-based evidence flow well.', 'Usually wants detailed repair-network explanations.'],
    riskSignals: ['Performance sedan', 'Occasional long-distance weekend driving'],
    profileNote: 'Tech-forward customer with performance vehicle and accessory coverage.',
    policies: [
      makePolicy('cust_ethan_park', {
        policyRef: 'POL-AUTO-US-2026-EP01',
        policyType: 'Auto',
        holderName: 'Ethan Park',
        holderDob: '1994-05-06',
        holderEmail: 'ethan.park@baneox-demo.com',
        holderPhone: '+1-614-555-0133',
        address: '907 Keswick Lane, Columbus, OH 43085',
        coverageType: 'Auto — Liability, Collision, Comprehensive, OEM Parts',
        coverageActive: true,
        startDate: '2026-05-01',
        renewalDate: '2027-05-01',
        annualPremium: 1935,
        excessAmount: 1000,
        noClaims: 3,
        vehicles: [{ make: 'Genesis', model: 'G70 3.3T', registration: 'OHR-9046', year: 2023, colour: 'Makalu Gray', value: 48200 }],
        namedDrivers: ['Ethan Park'],
        connectedDevices: {
          dashcam: { manufacturer: 'Vantrue', model: 'N4 Pro', registeredApp: 'Vantrue', vehicleReg: 'OHR-9046' },
          telematics: { provider: 'OnStar Insurance', vehicleReg: 'OHR-9046', appName: 'OnStar' },
        },
        notes: 'Accessory endorsement includes aftermarket wheels and ceramic coating.',
      }),
    ],
  },
];

function buildDerivedPersonaId(name: string): string {
  return `cust_${slugify(name)}`;
}

function sortClaimsNewestFirst(claims: Claim[]): Claim[] {
  return [...claims].sort((a, b) => {
    const left = new Date(b.updatedAt ?? b.createdAt).getTime();
    const right = new Date(a.updatedAt ?? a.createdAt).getTime();
    return left - right;
  });
}

function buildPersonaFromClaimant(name: string, claims: Claim[], policies: Policy[], base?: Partial<CustomerPersona>): CustomerPersona {
  const sortedClaims = sortClaimsNewestFirst(claims);
  const currentClaimIds = sortedClaims
    .filter((claim) => claim.claimStage !== 'settlement')
    .map((claim) => claim.id);
  const priorClaimIds = sortedClaims
    .filter((claim) => claim.claimStage === 'settlement')
    .map((claim) => claim.id);
  const policySummary = summarizePolicies(policies);
  const latestClaim = sortedClaims[0];
  const isBusiness = base?.entityType === 'business' || isBusinessName(name);
  const firstName = isBusiness ? name : name.split(' ')[0];
  const lastName = isBusiness ? undefined : name.split(' ').slice(1).join(' ') || undefined;

  return {
    id: base?.id ?? buildDerivedPersonaId(name),
    displayName: name,
    firstName,
    lastName,
    entityType: isBusiness ? 'business' : 'individual',
    selectable: base?.selectable ?? false,
    locale: 'en-US',
    timeZone: base?.timeZone ?? 'America/New_York',
    email: base?.email ?? policies[0]?.holderEmail,
    phone: base?.phone ?? policies[0]?.holderPhone,
    preferredContactChannel: base?.preferredContactChannel ?? 'Phone',
    addressLine1: base?.addressLine1 ?? policies[0]?.address?.split(',')[0]?.trim(),
    city: base?.city ?? policies[0]?.address?.split(',')[1]?.trim(),
    state: base?.state ?? undefined,
    postalCode: base?.postalCode ?? undefined,
    customerSince: base?.customerSince ?? policies[0]?.startDate,
    occupation: base?.occupation,
    household: base?.household,
    defaultPolicyRef: base?.defaultPolicyRef ?? policies[0]?.policyRef,
    policyRefs: policies.map((policy) => policy.policyRef),
    currentClaimIds,
    priorClaimIds,
    supportSummary: {
      ...policySummary,
      activeClaimCount: currentClaimIds.length,
    },
    notes: base?.notes ?? [],
    riskSignals: base?.riskSignals ?? latestClaim?.immediateNeeds ?? [],
    profileNote: base?.profileNote ?? (latestClaim
      ? `Latest claim ${latestClaim.id} involves ${latestClaim.incidentType.toLowerCase()} loss handling.`
      : 'Derived from existing claim and policy history.'),
    serviceTier: base?.serviceTier ?? 'standard',
    appointedRepresentative: base?.appointedRepresentative,
  };
}

function selectableSeedByName(name: string): SeededPersona | undefined {
  return SELECTABLE_PERSONAS.find((persona) => persona.displayName.toLowerCase() === name.trim().toLowerCase());
}

// Ensure every persona returned to callers has a service tier, even older
// persisted records created before the field existed. A matching selectable
// seed wins so demo personas keep their intended tier.
function applyTierDefaults(persona: CustomerPersona): CustomerPersona {
  const seed = SELECTABLE_PERSONAS.find((s) => s.id === persona.id);
  const serviceTier = seed?.serviceTier ?? persona.serviceTier ?? 'standard';
  const appointedRepresentative = seed?.appointedRepresentative ?? persona.appointedRepresentative;
  if (persona.serviceTier === serviceTier && persona.appointedRepresentative === appointedRepresentative) {
    return persona;
  }
  return { ...persona, serviceTier, appointedRepresentative };
}

export async function syncCustomerPersonaData(): Promise<void> {
  await personaRepo.ensureContainer();
  await policiesRepo.ensureContainer();

  for (const persona of SELECTABLE_PERSONAS) {
    for (const policy of persona.policies) {
      await policiesRepo.upsert(policy);
    }
  }

  const claims = await claimsRepo.findAll().catch(() => [] as Claim[]);
  const policies = await policiesRepo.findAll().catch(() => [] as Policy[]);

  const personaByName = new Map<string, CustomerPersona>();

  for (const seed of SELECTABLE_PERSONAS) {
    const matchingClaims = claims.filter((claim) => claim.claimantName.trim().toLowerCase() === seed.displayName.toLowerCase());
    const matchingPolicies = policies.filter((policy) => policy.personaId === seed.id);
    const persona = buildPersonaFromClaimant(seed.displayName, matchingClaims, matchingPolicies, seed);
    personaByName.set(seed.displayName.toLowerCase(), persona);
    await personaRepo.upsert(persona);
  }

  for (const claim of claims) {
    const derivedId = personaByName.get(claim.claimantName.trim().toLowerCase())?.id ?? buildDerivedPersonaId(claim.claimantName);
    if (claim.claimantPersonaId !== derivedId) {
      await claimsRepo.upsert({
        ...claim,
        claimantPersonaId: derivedId,
      });
    }
  }

  const refreshedClaims = await claimsRepo.findAll().catch(() => [] as Claim[]);
  const groupedClaims = new Map<string, Claim[]>();
  for (const claim of refreshedClaims) {
    const key = claim.claimantName.trim().toLowerCase();
    const current = groupedClaims.get(key) ?? [];
    current.push(claim);
    groupedClaims.set(key, current);
  }

  for (const [nameKey, claimantClaims] of groupedClaims.entries()) {
    if (personaByName.has(nameKey)) continue;
    const displayName = claimantClaims[0]?.claimantName ?? nameKey;
    const matchingPolicies = policies.filter((policy) => policy.holderName.trim().toLowerCase() === nameKey);
    // Preserve the tier already set on the claim record so auto-generated personas
    // (e.g. white_glove clients not in SELECTABLE_PERSONAS) don't revert to 'standard'.
    const claimTier = claimantClaims[0]?.clientServiceTier;
    const persona = buildPersonaFromClaimant(displayName, claimantClaims, matchingPolicies,
      claimTier ? { serviceTier: claimTier } : undefined);
    await personaRepo.upsert(persona);
  }
}

export async function getCustomerPersonas(selectableOnly = false): Promise<CustomerPersona[]> {
  const personas = await personaRepo.findAll().catch(() => [] as CustomerPersona[]);
  const source = personas.length
    ? personas
    : SELECTABLE_PERSONAS.map((persona) => buildPersonaFromClaimant(persona.displayName, [], persona.policies, persona));
  return source
    .filter((persona) => !selectableOnly || persona.selectable)
    .map(applyTierDefaults)
    .sort((a, b) => Number(b.selectable) - Number(a.selectable) || a.displayName.localeCompare(b.displayName));
}

export async function getCustomerPersona(id: string): Promise<CustomerPersona | null> {
  const persona = await personaRepo.findById(id).catch(() => null);
  if (persona) return applyTierDefaults(persona);
  const fallback = SELECTABLE_PERSONAS.find((seed) => seed.id === id);
  return fallback ? applyTierDefaults(buildPersonaFromClaimant(fallback.displayName, [], fallback.policies, fallback)) : null;
}

export async function getCustomerPersonaByName(name: string): Promise<CustomerPersona | null> {
  const personas = await getCustomerPersonas(false);
  return personas.find((persona) => persona.displayName.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
}

/**
 * Resolve the service tier for a claimant, preferring an explicit persona id and
 * falling back to a name lookup. Defaults to 'standard' when no persona matches.
 */
export async function resolveServiceTier(opts: { personaId?: string; claimantName?: string }): Promise<ClientServiceTier> {
  if (opts.personaId) {
    const byId = await getCustomerPersona(opts.personaId);
    if (byId) return byId.serviceTier;
  }
  if (opts.claimantName) {
    const byName = await getCustomerPersonaByName(opts.claimantName);
    if (byName) return byName.serviceTier;
  }
  return 'standard';
}

/**
 * Resolve an explicit Appointed Representative recorded against a persona, if
 * any. Falls back to undefined so callers can derive a default for top tiers.
 */
export async function resolveAppointedRepresentative(opts: {
  personaId?: string;
  claimantName?: string;
}): Promise<AppointedRepresentative | undefined> {
  if (opts.personaId) {
    const byId = await getCustomerPersona(opts.personaId);
    if (byId?.appointedRepresentative) return byId.appointedRepresentative;
  }
  if (opts.claimantName) {
    const byName = await getCustomerPersonaByName(opts.claimantName);
    if (byName?.appointedRepresentative) return byName.appointedRepresentative;
  }
  return undefined;
}

export function formatCustomerPersonaContext(persona: CustomerPersona): string {
  return `CUSTOMER PROFILE:
  Persona ID    : ${persona.id}
  Customer Name : ${persona.displayName}
  Preferred Mode: ${persona.preferredContactChannel}
  Location      : ${[persona.city, persona.state, persona.postalCode].filter(Boolean).join(', ') || 'US address on file'}
  Customer Since: ${persona.customerSince ?? 'Unknown'}
  Policy Count  : ${persona.supportSummary.policyCount}
  Open Claims   : ${persona.supportSummary.activeClaimCount}
  Annual Premium: ${formatUsd(persona.supportSummary.totalAnnualPremium)}
  Claim-Free    : ${persona.supportSummary.claimFreeYears} year(s)
  Notes         : ${persona.notes.length ? persona.notes.join(' | ') : 'No special notes'}
  Risk Signals  : ${persona.riskSignals.length ? persona.riskSignals.join(' | ') : 'No elevated signals recorded'}
  Profile Note  : ${persona.profileNote}`;
}
