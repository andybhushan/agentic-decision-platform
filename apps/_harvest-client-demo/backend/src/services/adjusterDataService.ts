import type { Claim, AdjusterProfile, FNOLSubmission, Priority, ClientServiceTier, ClaimHandlingMode } from '../types';
import type { Policy } from './policyService';
import { CosmosRepository } from './cosmosRepository';
import { resolveServiceTier } from './customerPersonaService';

type AdjusterRecord = AdjusterProfile & { role: 'adjuster' };

const staffRepo = new CosmosRepository<AdjusterRecord>('staff');
const claimsRepo = new CosmosRepository<Claim>('claims');
const policiesRepo = new CosmosRepository<Policy>('policies');

const BUILTIN_ADJUSTERS: AdjusterRecord[] = [
  {
    id: 'adj_patel',
    role: 'adjuster',
    name: 'Priya Patel',
    email: 'p.patel@baneandox.co.uk',
    phone: '+44-20-7946-0300',
    team: 'Major Loss & Complex Claims',
    seniority: 'Principal',
    yearsExperience: 18,
    specialisations: ['Motor Major Loss', 'Fraud Investigation', 'Liability Disputes', 'Commercial Auto'],
    authorityLimit: 50000,
    currentWorkload: 0,
    maxCapacity: 8,  // Principal — complex fraud/major loss only
    status: 'available',
    bio: 'Principal motor adjuster handling complex liability, SIU-led, and high-exposure auto losses.',
    stats: {
      avgResolutionDays: 42,
      customerSatisfaction: 4.7,
      successRate: 94,
      totalClaimsClosed: 1240,
    },
    clientHistory: [
      { claimantName: 'Patricia O\'Connor', claimId: 'CLM-2024-003', outcome: 'Disputed liability resolved with injury component preserved.' },
      { claimantName: 'Robert Martinez', claimId: 'CLM-2024-002', outcome: 'Fraud indicators escalated for SIU review.' },
    ],
  },
  {
    id: 'adj_whitfield',
    role: 'adjuster',
    name: 'James Whitfield',
    email: 'j.whitfield@baneandox.co.uk',
    phone: '+44-20-7946-0301',
    team: 'Motor Claims',
    seniority: 'Senior',
    yearsExperience: 15,
    specialisations: ['Motor Damage', 'Third-Party Liability', 'Vehicle Recovery', 'Repair Cost Control'],
    authorityLimit: 25000,
    currentWorkload: 0,
    maxCapacity: 15,  // Senior motor — standard claim volume
    status: 'available',
    bio: 'Senior motor adjuster focused on clean-fault, repair, and recovery-led auto claims.',
    stats: {
      avgResolutionDays: 28,
      customerSatisfaction: 4.5,
      successRate: 91,
      totalClaimsClosed: 876,
    },
    clientHistory: [
      { claimantName: 'Sarah Johnson', claimId: 'CLM-2024-001', outcome: 'Rear-end repair claim settled with full third-party recovery.' },
    ],
  },
  {
    id: 'adj_pemberton',
    role: 'adjuster',
    name: 'Sarah Pemberton',
    email: 's.pemberton@baneandox.co.uk',
    phone: '+44-20-7946-0302',
    team: 'Motor Injury',
    seniority: 'Senior',
    yearsExperience: 8,
    specialisations: ['Motor Injury', 'Whiplash', 'Rehabilitation', 'Cyclist Claims'],
    authorityLimit: 15000,
    currentWorkload: 0,
    maxCapacity: 12,  // Senior injury — complex medico-legal caseloads
    status: 'available',
    bio: 'Senior motor injury adjuster coordinating rehab, medico-legal evidence, and injury quantum.',
    stats: {
      avgResolutionDays: 35,
      customerSatisfaction: 4.8,
      successRate: 89,
      totalClaimsClosed: 412,
    },
    clientHistory: [],
  },
  {
    id: 'adj_chen',
    role: 'adjuster',
    name: 'Michael Chen',
    email: 'm.chen@baneandox.co.uk',
    phone: '+44-20-7946-0303',
    team: 'Major Loss Unit',
    seniority: 'Lead',
    yearsExperience: 22,
    specialisations: ['Prestige Auto', 'Fleet', 'Catastrophic Injury', 'Commercial Recovery'],
    authorityLimit: 100000,
    currentWorkload: 0,
    maxCapacity: 6,
    status: 'available',
    bio: 'Lead auto major-loss adjuster for prestige, fleet, and multi-party motor losses.',
    stats: {
      avgResolutionDays: 68,
      customerSatisfaction: 4.9,
      successRate: 97,
      totalClaimsClosed: 540,
    },
    clientHistory: [],
  },
  {
    id: 'adj_blackwood',
    role: 'adjuster',
    name: 'Emma Blackwood',
    email: 'e.blackwood@baneandox.co.uk',
    phone: '+44-20-7946-0304',
    team: 'Fast-Track Motor',
    seniority: 'Junior',
    yearsExperience: 5,
    specialisations: ['Fast-Track Motor', 'Low-Value Repairs', 'Portal Claims', 'Courtesy Car Claims'],
    authorityLimit: 5000,
    currentWorkload: 0,
    maxCapacity: 20,  // Junior fast-track — high volume, low complexity
    status: 'available',
    bio: 'Fast-track motor adjuster focused on low-complexity auto claims and rapid settlement.',
    stats: {
      avgResolutionDays: 12,
      customerSatisfaction: 4.4,
      successRate: 88,
      totalClaimsClosed: 620,
    },
    clientHistory: [],
  },
  {
    id: 'adj_ashworth',
    role: 'adjuster',
    name: 'David Ashworth',
    email: 'd.ashworth@baneandox.co.uk',
    phone: '+44-20-7946-0305',
    team: 'Motor Claims',
    seniority: 'Senior',
    yearsExperience: 12,
    specialisations: ['Motor', 'Liability Review', 'Multi-Vehicle Impact', 'Repair vs Total Loss'],
    authorityLimit: 25000,
    currentWorkload: 0,
    maxCapacity: 18,  // Senior — multi-vehicle/comprehensive, broad claim types
    status: 'available',
    bio: 'Senior adjuster for standard-to-complex motor losses needing stronger liability analysis.',
    stats: {
      avgResolutionDays: 31,
      customerSatisfaction: 4.6,
      successRate: 92,
      totalClaimsClosed: 710,
    },
    clientHistory: [],
  },
];

/** Sync lookup — builtins only, no Cosmos round-trip. Suitable for governance checks. */
export function getBuiltinAdjusterLimit(adjusterId: string | undefined): number {
  if (!adjusterId) return 10000;
  const adjuster = BUILTIN_ADJUSTERS.find((a) => a.id === adjusterId);
  return adjuster?.authorityLimit ?? 10000;
}

const EXISTING_CLAIM_ASSIGNMENTS: Record<string, string> = {
  'CLM-2024-001': 'adj_whitfield',
  'CLM-2024-002': 'adj_patel',
  'CLM-2024-003': 'adj_patel',
  'CLM-2026-004821': 'adj_patel',
  'CLM-2026-004798': 'adj_whitfield',
  'CLM-2026-004710': 'adj_ashworth',
  'CLM-2026-004655': 'adj_ashworth',
  'CLM-2026-004819': 'adj_whitfield',
  'CLM-2026-004892': 'adj_blackwood',
  'CLM-2026-004901': 'adj_blackwood',
  'CLM-2026-004915': 'adj_pemberton',
  'CLM-2026-004928': 'adj_blackwood',
  'CLM-2026-004935': 'adj_ashworth',
};

function ownerName(name: string): string {
  return name.toUpperCase();
}

function makePolicy(input: Omit<Policy, 'id'>): Policy {
  return { ...input, id: input.policyRef };
}

function makeEvidence(
  id: string,
  type: string,
  description: string,
  source: string,
  status: 'pending' | 'verified' | 'disputed',
  dateReceived: string
): Claim['evidenceItems'][number] {
  return {
    id,
    type,
    description,
    source,
    provenance: 'Public Record',
    dateReceived,
    status,
  };
}

function makeAnomaly(
  id: string,
  type: string,
  description: string,
  severity: 'low' | 'medium' | 'high',
  evidenceSource: string,
  explanation: string
): Claim['anomalySignals'][number] {
  return { id, type, description, severity, evidenceSource, explanation };
}

function makePriorityFromSubmission(submission: FNOLSubmission): Priority {
  if (submission.injuryIndicated) return 'urgent';
  const text = `${submission.incidentDescription} ${submission.incidentLocation}`.toLowerCase();
  if (/(fraud|staged|fleet|hgv|commercial|prestige|rolls|porsche|fatal|multi-vehicle)/.test(text)) {
    return 'high';
  }
  return 'normal';
}

const DEMO_POLICIES: Policy[] = [
  makePolicy({
    policyRef: 'POL-AUTO-2026-OKO01',
    policyType: 'Motor',
    holderName: 'Daniel Okonkwo',
    holderDob: '1987-11-03',
    holderEmail: 'd.okonkwo@outlook.co.uk',
    holderPhone: '+44-7700-900-105',
    address: '27 Elmsbury Road, London, E13 9PY',
    coverageType: 'Third-Party Fire & Theft',
    coverageActive: true,
    startDate: '2026-01-01',
    renewalDate: '2027-01-01',
    annualPremium: 1640,
    excessAmount: 450,
    noClaims: 1,
    vehicles: [{ make: 'Volkswagen', model: 'Golf GTD', registration: 'DL22 OKO', year: 2022, colour: 'Deep Black', value: 21500 }],
    namedDrivers: ['Daniel Okonkwo'],
    notes: 'E13 postcode pricing uplift. Telematics app connected. Prior fraud screening notes on file.',
  }),
  makePolicy({
    policyRef: 'POL-AUTO-2026-MAR01',
    policyType: 'Motor',
    holderName: 'Sophie Martinez',
    holderDob: '1993-08-19',
    holderEmail: 's.martinez@mail.co.uk',
    holderPhone: '+44-7700-900-106',
    address: '84 Rutland Street, London, W3 8RA',
    coverageType: 'Comprehensive Motor',
    coverageActive: true,
    startDate: '2026-02-01',
    renewalDate: '2027-02-01',
    annualPremium: 1265,
    excessAmount: 300,
    noClaims: 5,
    vehicles: [{ make: 'Volvo', model: 'XC40', registration: 'SM26 TPF', year: 2024, colour: 'Silver Dawn', value: 37000 }],
    namedDrivers: ['Sophie Martinez'],
    notes: 'Includes rehabilitation pathway and hire vehicle cover.',
  }),
  makePolicy({
    policyRef: 'POL-AUTO-2026-FAIR01',
    policyType: 'Prestige Motor',
    holderName: 'Charlotte Fairweather',
    holderDob: '1978-04-06',
    holderEmail: 'c.fairweather@email.co.uk',
    holderPhone: '+44-7700-900-110',
    address: '12 Chester Square, London, SW1W 9AA',
    coverageType: 'Prestige Motor — Agreed Value',
    coverageActive: true,
    startDate: '2026-01-15',
    renewalDate: '2027-01-15',
    annualPremium: 11840,
    excessAmount: 1500,
    noClaims: 9,
    vehicles: [{ make: 'Rolls-Royce', model: 'Ghost Black Badge', registration: 'CF26 LUX', year: 2024, colour: 'Midnight Sapphire', value: 280000 }],
    namedDrivers: ['Charlotte Fairweather', 'Alexander Fairweather'],
    notes: 'Agreed value schedule in force; manufacturer-approved repair network only.',
  }),
  makePolicy({
    policyRef: 'POL-FLEET-2026-NEX01',
    policyType: 'Commercial Fleet',
    holderName: 'Nexus Logistics Ltd',
    holderEmail: 'claims@nexuslogistics.co.uk',
    holderPhone: '+44-20-7946-0500',
    address: 'Unit 4, Meridian Park, Warrington, WA1 4AJ',
    coverageType: 'Commercial Fleet — Comprehensive + Cargo',
    coverageActive: true,
    startDate: '2026-01-01',
    renewalDate: '2027-01-01',
    annualPremium: 48750,
    excessAmount: 2500,
    noClaims: 0,
    vehicles: [
      { make: 'Mercedes-Benz', model: 'Sprinter 315', registration: 'NX65 LKT', year: 2022, colour: 'White', value: 26000 },
      { make: 'Mercedes-Benz', model: 'Sprinter 315', registration: 'NX65 PRM', year: 2022, colour: 'White', value: 24000 },
    ],
    namedDrivers: ['J. Owens', 'R. Singh'],
    notes: 'Includes cargo-in-transit cover and MIB recovery assistance for uninsured TP events.',
  }),
  makePolicy({
    policyRef: 'POL-AUTO-2026-WHIT01',
    policyType: 'Motor',
    holderName: 'Emma Whitmore',
    holderDob: '1990-02-22',
    holderEmail: 'e.whitmore@email.co.uk',
    holderPhone: '+44-7700-900-111',
    address: '3 Marston Road, Oxford, OX3 0NP',
    coverageType: 'Comprehensive Motor',
    coverageActive: true,
    startDate: '2026-03-01',
    renewalDate: '2027-03-01',
    annualPremium: 980,
    excessAmount: 250,
    noClaims: 6,
    vehicles: [{ make: 'Mini', model: 'Cooper S', registration: 'EW26 OXF', year: 2023, colour: 'British Racing Green', value: 28500 }],
    namedDrivers: ['Emma Whitmore'],
    notes: 'Standard comprehensive policy with third-party injury liability.',
  }),
  makePolicy({
    policyRef: 'POL-AUTO-2026-WEBB01',
    policyType: 'Motor',
    holderName: 'Marcus Webb',
    holderDob: '1985-12-02',
    holderEmail: 'm.webb@email.co.uk',
    holderPhone: '+44-7700-900-112',
    address: '15 Portsmouth Road, Guildford, GU2 7YQ',
    coverageType: 'Comprehensive Motor',
    coverageActive: true,
    startDate: '2026-01-01',
    renewalDate: '2027-01-01',
    annualPremium: 1145,
    excessAmount: 300,
    noClaims: 7,
    vehicles: [{ make: 'BMW', model: '530e M Sport', registration: 'MW22 BMW', year: 2022, colour: 'Arctic Grey', value: 34800 }],
    namedDrivers: ['Marcus Webb'],
    notes: 'Courtesy car included with approved repairer option.',
  }),
];

const DEMO_CLAIMS: Claim[] = [
  {
    id: 'CLM-2026-AUTO-014',
    claimantName: 'Daniel Okonkwo',
    claimantEmail: 'd.okonkwo@outlook.co.uk',
    claimantPhone: '+44-7700-900-105',
    incidentType: 'Auto',
    incidentDate: '2026-05-30',
    incidentTime: '22:45',
    incidentLocation: 'Barking Road, London, E13 8HB',
    partiesInvolved: [
      { name: 'Daniel Okonkwo', role: 'Claimant Driver' },
      { name: 'Two unidentified passengers', role: 'Alleged Injured Parties' },
      { name: 'PC 4471 Rawlings', role: 'Police Officer' },
    ],
    injuryIndicated: true,
    policeReportRef: 'POL-INC-E13-8847',
    immediateNeeds: ['Vehicle recovery'],
    preferredContactChannel: 'Phone',
    incidentDescription: 'Claimant reports a stationary vehicle was struck by a fleeing third party in a high-fraud-risk postcode. Two passengers allege whiplash. No independent witnesses and no third-party details confirmed.',
    intakeChannel: 'Phone',
    policyRef: 'POL-AUTO-2026-OKO01',
    policyContext: {
      policyNumber: 'POL-AUTO-2026-OKO01',
      coverageType: 'Third-Party Fire & Theft',
      relevantClauses: ['Section 2: Third-party liability cover active', 'Section 4: Fraud voidance rights', 'Section 14: Untraced driver clause'],
      coverageApplicability: 'covered',
      ambiguityIndicators: ['No third-party details and no independent witnesses.'],
    },
    claimStage: 'investigation',
    pendingDecisionType: 'Fraud Investigation',
    blockerReason: 'SIU screening required before indemnity can proceed.',
    confidenceLevel: 'low',
    complexity: 'high',
    lastAgentAction: 'Fraud Detection DW raised SIU referral after staged-accident indicators were detected.',
    timeInQueue: '4 hours',
    priority: 'urgent',
    owner: ownerName('Priya Patel'),
    workingOn: 'SIU Review',
    assignedAdjusterId: 'adj_patel',
    assignedAdjusterName: 'Priya Patel',
    narrativeSynthesis: [
      { timestamp: '2026-05-30T22:45:00Z', description: 'Reported hit by a fleeing third party while stationary.', status: 'Pending', source: 'Claimant Statement' },
      { timestamp: '2026-05-30T23:10:00Z', description: 'Police attended but could not trace the third party.', status: 'Confirmed', source: 'Police Incident Log' },
      { timestamp: '2026-05-31T09:00:00Z', description: 'Automated screening flagged organised-fraud indicators.', status: 'Confirmed', source: 'Fraud Detection DW' },
    ],
    anomalySignals: [
      makeAnomaly('AN-A014-001', 'High-risk postcode', 'Incident occurred in a top-loss fraud hotspot.', 'high', 'Fraud scoring model', 'Geo-risk model elevates E13 late-night untraced incidents.'),
      makeAnomaly('AN-A014-002', 'Untraced third party', 'No independent witness or corroborating third-party details.', 'high', 'Police incident log', 'Lack of corroboration increases staged-accident risk.'),
    ],
    evidenceItems: [
      makeEvidence('EV-A014-001', 'Police Report', 'Attending officer log with no traced third party.', 'Police Incident Log', 'verified', '2026-05-30T23:15:00Z'),
      makeEvidence('EV-A014-002', 'Vehicle Inspection', 'Repair inspection pending on recovered vehicle.', 'Approved Repairer', 'pending', '2026-05-31T10:30:00Z'),
    ],
    recommendedAction: {
      actionType: 'Progress SIU Review',
      description: 'Hold indemnity until CCTV, telematics, and occupancy checks are complete.',
      confidence: 'low',
      rationale: 'Multiple fraud markers make early payment unsafe.',
      estimatedImpact: 'Potential prevented loss £15,000–£35,000 if fraud confirmed.',
      agentId: 'agent_fraud_001',
      agentName: 'Fraud Detection DW',
      claimantMessage: 'We are reviewing your claim and may need additional information before we can progress it.',
      financialImpact: {
        estimatedAmount: 22000,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'CLM-2026-AUTO-015',
    claimantName: 'Sophie Martinez',
    claimantEmail: 's.martinez@mail.co.uk',
    claimantPhone: '+44-7700-900-106',
    incidentType: 'Auto',
    incidentDate: '2026-06-02',
    incidentTime: '08:15',
    incidentLocation: 'A40 Western Avenue, London, W3 9JP',
    partiesInvolved: [
      { name: 'Sophie Martinez', role: 'Claimant Driver' },
      { name: 'Peter Gallagher', role: 'At-Fault Third Party' },
    ],
    injuryIndicated: true,
    policeReportRef: 'PC-2026-W3-1142',
    immediateNeeds: ['Physiotherapy referral', 'Hire vehicle'],
    preferredContactChannel: 'Email',
    incidentDescription: 'Rear-end collision at roadworks queue. The third party admitted fault. Claimant reports moderate whiplash, trapezius strain, and sleep disruption.',
    intakeChannel: 'Web Portal',
    policyRef: 'POL-AUTO-2026-MAR01',
    policyContext: {
      policyNumber: 'POL-AUTO-2026-MAR01',
      coverageType: 'Comprehensive Motor',
      relevantClauses: ['Section 4: Rehab pathway required for injury claims', 'Section 6: Hire vehicle available while repairs progress'],
      coverageApplicability: 'covered',
      ambiguityIndicators: [],
    },
    claimStage: 'investigation',
    pendingDecisionType: 'Coverage Verification',
    blockerReason: 'Physiotherapy assessment is still pending, so injury quantum is not ready.',
    confidenceLevel: 'medium',
    complexity: 'high',
    lastAgentAction: 'Injury DW arranged a MedCo physiotherapy appointment within 5 days.',
    timeInQueue: '1 hour',
    priority: 'high',
    owner: ownerName('Sarah Pemberton'),
    workingOn: 'Physiotherapy Assessment',
    assignedAdjusterId: 'adj_pemberton',
    assignedAdjusterName: 'Sarah Pemberton',
    narrativeSynthesis: [
      { timestamp: '2026-06-02T08:15:00Z', description: 'Rear-end collision at roadworks with fault admitted at scene.', status: 'Confirmed', source: 'Police Report' },
      { timestamp: '2026-06-02T09:30:00Z', description: 'A&E diagnosed whiplash grade II and trapezius strain.', status: 'Confirmed', source: 'A&E Discharge Note' },
    ],
    anomalySignals: [],
    evidenceItems: [
      makeEvidence('EV-A015-001', 'Police Report', 'Attending officer report confirming third-party fault.', 'Police Report', 'verified', '2026-06-02T08:45:00Z'),
      makeEvidence('EV-A015-002', 'Medical Report', 'A&E discharge note for whiplash and muscle strain.', 'Hospital', 'verified', '2026-06-02T10:00:00Z'),
      makeEvidence('EV-A015-003', 'Medical Report', 'Physiotherapy prognosis pending.', 'MedCo Provider', 'pending', '2026-06-02T11:00:00Z'),
    ],
    recommendedAction: {
      actionType: 'Continue Rehab Pathway',
      description: 'Complete physiotherapy assessment and prepare third-party recovery pack.',
      confidence: 'high',
      rationale: 'Liability is clear but medical prognosis is still developing.',
      estimatedImpact: 'Expected settlement £4,500–£12,000 plus vehicle costs.',
      agentId: 'agent_injury_001',
      agentName: 'Injury & Rehab DW',
      claimantMessage: 'We have arranged your physiotherapy assessment and approved your hire vehicle.',
      financialImpact: {
        estimatedAmount: 9000,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'CLM-2026-AUTO-016',
    claimantName: 'Charlotte Fairweather',
    claimantEmail: 'c.fairweather@email.co.uk',
    claimantPhone: '+44-7700-900-110',
    incidentType: 'Auto',
    incidentDate: '2026-05-18',
    incidentTime: '16:40',
    incidentLocation: 'Park Lane, London, W1K 7AE',
    partiesInvolved: [
      { name: 'Charlotte Fairweather', role: 'Claimant Driver' },
      { name: 'Lorenzo Bianchi', role: 'At-Fault Third Party' },
    ],
    injuryIndicated: false,
    policeReportRef: 'MPS-2026-PL-0018',
    immediateNeeds: ['Vehicle recovery', 'Prestige hire car'],
    preferredContactChannel: 'Email',
    incidentDescription: 'A 2024 Rolls-Royce Ghost Black Badge valued at £280,000 was struck by a red-light-running third party. Structural front-end damage indicates a likely total loss.',
    intakeChannel: 'Web Portal',
    policyRef: 'POL-AUTO-2026-FAIR01',
    policyContext: {
      policyNumber: 'POL-AUTO-2026-FAIR01',
      coverageType: 'Prestige Motor — Agreed Value',
      relevantClauses: ['Section 2.1: Agreed value payout on total loss', 'Section 6.3: Manufacturer-approved repair network only'],
      coverageApplicability: 'covered',
      ambiguityIndicators: ['Third-party insurer may challenge total-loss quantum.'],
    },
    claimStage: 'evaluation',
    pendingDecisionType: 'Settlement Approval',
    blockerReason: 'Formal total-loss certificate is pending from the manufacturer-approved repairer.',
    confidenceLevel: 'high',
    complexity: 'medium',
    lastAgentAction: 'Major Loss DW instructed a prestige vehicle engineer for valuation sign-off.',
    timeInQueue: '3 hours',
    priority: 'urgent',
    owner: ownerName('Michael Chen'),
    workingOn: 'Total Loss Valuation',
    assignedAdjusterId: 'adj_chen',
    assignedAdjusterName: 'Michael Chen',
    narrativeSynthesis: [
      { timestamp: '2026-05-18T16:40:00Z', description: 'Prestige vehicle struck at signalised junction.', status: 'Confirmed', source: 'Police Report' },
      { timestamp: '2026-05-19T10:00:00Z', description: 'Approved repairer confirmed uneconomical repair threshold.', status: 'Confirmed', source: 'Workshop Assessment' },
    ],
    anomalySignals: [
      makeAnomaly('AN-A016-001', 'High-value total loss', 'Agreed-value prestige vehicle exceeds standard major loss threshold.', 'medium', 'Policy schedule', 'Requires major-loss governance and reinsurance notification.'),
    ],
    evidenceItems: [
      makeEvidence('EV-A016-001', 'Police Report', 'Met Police report confirming third-party fault.', 'Police Report', 'verified', '2026-05-18T17:10:00Z'),
      makeEvidence('EV-A016-002', 'Repair Estimate', 'Prestige repairer total-loss recommendation.', 'Workshop Assessment', 'verified', '2026-05-19T10:00:00Z'),
    ],
    recommendedAction: {
      actionType: 'Approve Total Loss',
      description: 'Confirm agreed-value total loss and initiate full third-party recovery.',
      confidence: 'high',
      rationale: 'Liability is admitted and the vehicle is likely beyond economical repair.',
      estimatedImpact: 'Total loss £280,000 with expected full recovery.',
      agentId: 'agent_major_loss_001',
      agentName: 'Major Loss DW',
      claimantMessage: 'We are finalising the total-loss certificate and will confirm settlement within 48 hours.',
      financialImpact: {
        estimatedAmount: 280000,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'CLM-2026-AUTO-017',
    claimantName: 'Nexus Logistics Ltd',
    claimantEmail: 'claims@nexuslogistics.co.uk',
    claimantPhone: '+44-20-7946-0500',
    incidentType: 'Auto',
    incidentDate: '2026-05-12',
    incidentTime: '07:20',
    incidentLocation: 'M6 Motorway, Junction 21A, Warrington',
    partiesInvolved: [
      { name: 'Nexus Logistics Ltd', role: 'Fleet Policyholder' },
      { name: 'J. Owens', role: 'Injured Driver' },
      { name: 'Stanmore Couriers', role: 'Uninsured Third-Party HGV' },
    ],
    injuryIndicated: true,
    policeReportRef: 'GMP-2026-M6-4491',
    immediateNeeds: ['Driver medical assessment', 'Fleet replacement vehicles', 'Load recovery'],
    preferredContactChannel: 'Email',
    incidentDescription: 'Two insured fleet vans and an uninsured third-party HGV were involved in a motorway collision. One driver sustained back and neck injuries, one van is a write-off, and pharmaceutical cargo was partially destroyed.',
    intakeChannel: 'Phone',
    policyRef: 'POL-FLEET-2026-NEX01',
    policyContext: {
      policyNumber: 'POL-FLEET-2026-NEX01',
      coverageType: 'Commercial Fleet — Comprehensive + Cargo',
      relevantClauses: ['Section 3: Fleet vehicle cover', 'Section 7: Cargo in transit', 'Section 15: MIB recovery for uninsured TP'],
      coverageApplicability: 'covered',
      ambiguityIndicators: ['Cold-chain breach documentation still pending.'],
    },
    claimStage: 'investigation',
    pendingDecisionType: 'Anomaly Review',
    blockerReason: 'Uninsured third party requires MIB handling and cargo quantum is not finalised.',
    confidenceLevel: 'medium',
    complexity: 'high',
    lastAgentAction: 'Major Loss DW opened the MIB referral and requested a cargo survey.',
    timeInQueue: '2 days',
    priority: 'urgent',
    owner: ownerName('Michael Chen'),
    workingOn: 'MIB Referral',
    assignedAdjusterId: 'adj_chen',
    assignedAdjusterName: 'Michael Chen',
    narrativeSynthesis: [
      { timestamp: '2026-05-12T07:20:00Z', description: 'Three-vehicle motorway collision involving an uninsured HGV.', status: 'Confirmed', source: 'Police Report' },
      { timestamp: '2026-05-12T10:00:00Z', description: 'MID search confirmed the third-party HGV was uninsured.', status: 'Confirmed', source: 'MID Database' },
    ],
    anomalySignals: [
      makeAnomaly('AN-A017-001', 'Uninsured third party', 'The at-fault HGV was not insured on the MID database.', 'high', 'MID Database', 'Recovery must route through the Motor Insurers Bureau.'),
      makeAnomaly('AN-A017-002', 'Cargo exposure', 'Pharmaceutical load may carry spoilage and compliance losses.', 'medium', 'Cargo incident log', 'The cargo element increases complexity and quantum.'),
    ],
    evidenceItems: [
      makeEvidence('EV-A017-001', 'Police Report', 'GMP collision report for motorway incident.', 'Police Report', 'verified', '2026-05-12T08:00:00Z'),
      makeEvidence('EV-A017-002', 'Medical Report', 'Driver injury assessment pending final report.', 'Hospital', 'pending', '2026-05-12T09:15:00Z'),
      makeEvidence('EV-A017-003', 'Cargo Survey', 'Cargo spoilage report in progress.', 'Loss Surveyor', 'pending', '2026-05-12T13:00:00Z'),
    ],
    recommendedAction: {
      actionType: 'Progress MIB and Cargo Review',
      description: 'Quantify vehicle, injury, and cargo heads of loss before interim settlement.',
      confidence: 'medium',
      rationale: 'Multiple loss heads and an uninsured TP extend the decision path.',
      estimatedImpact: 'Estimated total exposure £95,000–£140,000.',
      agentId: 'agent_major_loss_001',
      agentName: 'Major Loss DW',
      claimantMessage: 'We have opened the Motor Insurers Bureau referral and are quantifying all elements of the fleet loss.',
      financialImpact: {
        estimatedAmount: 118000,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'CLM-2026-AUTO-018',
    claimantName: 'Oliver Kimura',
    claimantEmail: 'o.kimura@fastmail.co.uk',
    claimantPhone: '+44-7700-900-111',
    incidentType: 'Auto',
    incidentDate: '2026-06-04',
    incidentTime: '08:50',
    incidentLocation: 'CS Lewis Road, Oxford, OX4 2BP',
    partiesInvolved: [
      { name: 'Oliver Kimura', role: 'Cyclist / Claimant' },
      { name: 'Emma Whitmore', role: 'Insured Driver' },
    ],
    injuryIndicated: true,
    policeReportRef: 'TVP-2026-OX-3301',
    immediateNeeds: ['Hospital transport', 'Cycle replacement'],
    preferredContactChannel: 'Email',
    incidentDescription: 'An insured driver opened a car door into the path of a cyclist, causing a fractured clavicle, concussion, and loss-of-earnings exposure for a software engineer claimant.',
    intakeChannel: 'Web Portal',
    policyRef: 'POL-AUTO-2026-WHIT01',
    policyContext: {
      policyNumber: 'POL-AUTO-2026-WHIT01',
      coverageType: 'Comprehensive Motor — Third-Party Injury',
      relevantClauses: ['Section 3: Third-party injury liability', 'Section 8.2: Professional loss of earnings review'],
      coverageApplicability: 'covered',
      ambiguityIndicators: ['Professional day-rate evidence still required for loss of earnings.'],
    },
    claimStage: 'investigation',
    pendingDecisionType: 'Coverage Verification',
    blockerReason: 'Orthopaedic prognosis and loss-of-earnings verification remain outstanding.',
    confidenceLevel: 'high',
    complexity: 'high',
    lastAgentAction: 'Injury DW arranged orthopaedic follow-up and rehab coordination.',
    timeInQueue: '30 minutes',
    priority: 'high',
    owner: ownerName('Sarah Pemberton'),
    workingOn: 'Orthopaedic Assessment',
    assignedAdjusterId: 'adj_pemberton',
    assignedAdjusterName: 'Sarah Pemberton',
    narrativeSynthesis: [
      { timestamp: '2026-06-04T08:50:00Z', description: 'Cyclist thrown from bicycle after car door opening incident.', status: 'Confirmed', source: 'Police Report' },
      { timestamp: '2026-06-04T09:30:00Z', description: 'Hospital confirmed fractured clavicle and concussion.', status: 'Confirmed', source: 'A&E Admission Note' },
    ],
    anomalySignals: [
      makeAnomaly('AN-A018-001', 'Professional loss of earnings', 'Claimant works as a software engineer and may present higher earnings loss.', 'medium', 'Claimant disclosure', 'Independent contractor rate evidence is needed to value loss-of-earnings exposure.'),
    ],
    evidenceItems: [
      makeEvidence('EV-A018-001', 'Police Report', 'Police report confirming insured driver fault.', 'Police Report', 'verified', '2026-06-04T09:00:00Z'),
      makeEvidence('EV-A018-002', 'Medical Report', 'Hospital discharge and fracture note.', 'Hospital', 'verified', '2026-06-04T13:30:00Z'),
      makeEvidence('EV-A018-003', 'Medical Report', 'Orthopaedic prognosis pending.', 'Orthopaedic Clinic', 'pending', '2026-06-06T09:00:00Z'),
    ],
    recommendedAction: {
      actionType: 'Advance Injury Settlement Preparation',
      description: 'Complete medical prognosis and verify earnings evidence before quantum sign-off.',
      confidence: 'high',
      rationale: 'Liability is clean but injury and income evidence must mature before negotiation.',
      estimatedImpact: 'Expected exposure £18,000–£55,000.',
      agentId: 'agent_injury_001',
      agentName: 'Injury & Rehab DW',
      claimantMessage: 'We have arranged follow-up care and are reviewing the supporting evidence for your injury and earnings loss.',
      financialImpact: {
        estimatedAmount: 36000,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
  {
    id: 'CLM-2026-AUTO-019',
    claimantName: 'Marcus Webb',
    claimantEmail: 'm.webb@email.co.uk',
    claimantPhone: '+44-7700-900-112',
    incidentType: 'Auto',
    incidentDate: '2026-06-10',
    incidentTime: '17:15',
    incidentLocation: 'A3 Portsmouth Road, Guildford, GU2 7XJ',
    partiesInvolved: [
      { name: 'Marcus Webb', role: 'Claimant Driver' },
      { name: 'Fiona Heslop', role: 'At-Fault Third Party' },
    ],
    injuryIndicated: false,
    policeReportRef: 'SYP-2026-GU-0049',
    immediateNeeds: ['Repair authorisation', 'Courtesy car'],
    preferredContactChannel: 'Email',
    incidentDescription: 'A 2022 BMW 5 Series was rear-ended at a roadworks queue. Third-party fault is admitted and the repair estimate is £4,200.',
    intakeChannel: 'Web Portal',
    policyRef: 'POL-AUTO-2026-WEBB01',
    policyContext: {
      policyNumber: 'POL-AUTO-2026-WEBB01',
      coverageType: 'Comprehensive Motor',
      relevantClauses: ['Section 4.1: Approved repairer network', 'Section 10: Third-party recovery rights'],
      coverageApplicability: 'covered',
      ambiguityIndicators: [],
    },
    claimStage: 'investigation',
    pendingDecisionType: 'Coverage Verification',
    blockerReason: 'Repair authorisation is awaiting final workflow sign-off.',
    confidenceLevel: 'high',
    complexity: 'low',
    lastAgentAction: 'Coverage DW confirmed the policy is active and the repair estimate is within delegated authority.',
    timeInQueue: '1 hour',
    priority: 'normal',
    owner: ownerName('James Whitfield'),
    workingOn: 'Coverage Agent',
    assignedAdjusterId: 'adj_whitfield',
    assignedAdjusterName: 'James Whitfield',
    narrativeSynthesis: [
      { timestamp: '2026-06-10T17:15:00Z', description: 'Rear-end collision with third-party fault admitted.', status: 'Confirmed', source: 'Police Report' },
      { timestamp: '2026-06-10T18:00:00Z', description: 'Approved bodyshop repair estimate logged at £4,200.', status: 'Confirmed', source: 'Repair Estimate' },
    ],
    anomalySignals: [],
    evidenceItems: [
      makeEvidence('EV-A019-001', 'Police Report', 'Police report confirming liability.', 'Police Report', 'verified', '2026-06-10T17:45:00Z'),
      makeEvidence('EV-A019-002', 'Repair Estimate', 'Approved bodyshop estimate for bumper, boot lid, and parking sensors.', 'Approved Repairer', 'verified', '2026-06-10T18:00:00Z'),
    ],
    recommendedAction: {
      actionType: 'Authorise Repairs',
      description: 'Approve repairs and notify the third-party insurer of recovery intent.',
      confidence: 'high',
      rationale: 'Liability is clear and the repair pathway is straightforward.',
      estimatedImpact: 'Repair cost £4,200 plus hire charges.',
      agentId: 'agent_coverage_001',
      agentName: 'Coverage DW',
      claimantMessage: 'Your repairs are ready to be authorised and a courtesy car can be arranged immediately.',
      financialImpact: {
        estimatedAmount: 4200,
        currency: 'GBP',
      },
    },
    auditTrail: [{ timestamp: '2026-06-15T09:00:00Z', userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed' }],
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-06-15T09:00:00Z',
  },
];

function profileWithoutRole(record: AdjusterRecord): AdjusterProfile {
  const { role: _role, ...profile } = record;
  return profile;
}

function getBuiltInAdjusterMap(): Map<string, AdjusterRecord> {
  return new Map(BUILTIN_ADJUSTERS.map((adjuster) => [adjuster.id, adjuster]));
}

export async function getAdjusterProfiles(): Promise<AdjusterProfile[]> {
  const docs = await staffRepo.findAll().catch(() => [] as AdjusterRecord[]);
  const adjusters = docs.filter((doc) => doc.role === 'adjuster');
  return (adjusters.length ? adjusters : BUILTIN_ADJUSTERS).map(profileWithoutRole);
}

export async function getAdjusterProfile(id: string): Promise<AdjusterProfile | null> {
  const profile = await staffRepo.findById(id).catch(() => null);
  if (profile && profile.role === 'adjuster') return profileWithoutRole(profile);
  const fallback = BUILTIN_ADJUSTERS.find((adjuster) => adjuster.id === id);
  return fallback ? profileWithoutRole(fallback) : null;
}

export async function syncAdjusterDemoData(
  options: { seedDemoClaims?: boolean } = {},
): Promise<void> {
  // Legacy UK demo claims/policies (DEMO_CLAIMS, DEMO_POLICIES, EXISTING_CLAIM_ASSIGNMENTS)
  // are retired in favour of the curated production dataset in claimsDemoSeeder.ts.
  // They only seed when explicitly requested so they no longer resurrect on restart.
  const seedDemoClaims = options.seedDemoClaims === true;

  const [staffReady, claimsReady, policiesReady] = await Promise.all([
    staffRepo.ensureContainer('/id'),
    claimsRepo.ensureContainer('/id'),
    policiesRepo.ensureContainer('/id'),
  ]);

  if (!staffReady || !claimsReady || !policiesReady) {
    console.warn('[AdjusterData] Cosmos unavailable — skipping adjuster/claim sync');
    return;
  }

  for (const adjuster of BUILTIN_ADJUSTERS) {
    await staffRepo.upsert(adjuster);
  }

  if (seedDemoClaims) {
    for (const policy of DEMO_POLICIES) {
      await policiesRepo.upsert(policy);
    }

    const adjusterMap = getBuiltInAdjusterMap();
    const existingClaims = await claimsRepo.findAll();
    for (const claim of existingClaims) {
      const assignedAdjusterId = EXISTING_CLAIM_ASSIGNMENTS[claim.id];
      if (!assignedAdjusterId) continue;

      const adjuster = adjusterMap.get(assignedAdjusterId);
      if (!adjuster) continue;

      await claimsRepo.upsert({
        ...claim,
        incidentType: 'Auto',
        assignedAdjusterId,
        assignedAdjusterName: adjuster.name,
        owner: ownerName(adjuster.name),
      });
    }

    for (const claim of DEMO_CLAIMS) {
      await claimsRepo.upsert(claim);
    }
  }

  const allClaims = await claimsRepo.findAll();
  const workloads = new Map<string, number>();
  for (const claim of allClaims) {
    if (!claim.assignedAdjusterId) continue;
    // Only open claims count toward workload — closed/settled don't occupy capacity.
    if (claim.claimStage === 'closed') continue;
    workloads.set(claim.assignedAdjusterId, (workloads.get(claim.assignedAdjusterId) ?? 0) + 1);
  }

  for (const adjuster of BUILTIN_ADJUSTERS) {
    const currentWorkload = workloads.get(adjuster.id) ?? 0;
    const status = currentWorkload >= adjuster.maxCapacity ? 'at-capacity' : 'available';
    await staffRepo.upsert({
      ...adjuster,
      currentWorkload,
      status,
    });
  }
}

function keywordScore(text: string, patterns: RegExp[]): number {
  return patterns.some((pattern) => pattern.test(text)) ? 1 : 0;
}

type RoutingInput = Pick<FNOLSubmission, 'claimantName' | 'claimantPersonaId' | 'incidentLocation' | 'partiesInvolved' | 'injuryIndicated' | 'incidentDescription'>;

const SENIOR_SENIORITIES: ReadonlyArray<AdjusterProfile['seniority']> = ['Senior', 'Lead', 'Principal'];

function isSeniorAdjuster(adjuster: AdjusterProfile): boolean {
  return SENIOR_SENIORITIES.includes(adjuster.seniority);
}

function handlingModeForTier(tier: ClientServiceTier): ClaimHandlingMode {
  if (tier === 'signature' || tier === 'white_glove') return 'human';
  if (tier === 'priority') return 'ai_oversight';
  return 'ai';
}

function tierSignal(tier: ClientServiceTier): string {
  if (tier === 'signature') return 'Masterpiece Signature client — appointed representative engaged; routed to a senior human adjuster for white-glove handling.';
  if (tier === 'white_glove') return 'Masterpiece client — routed to a senior human adjuster for white-glove handling.';
  if (tier === 'priority') return 'Premier client — AI handling with senior adjuster oversight.';
  return 'Core client — eligible for full AI autonomous handling.';
}

export interface AdjusterAssignmentDecision {
  adjuster: AdjusterProfile;
  confidence: number;
  reason: string;
  signals: string[];
  serviceTier: ClientServiceTier;
  handlingMode: ClaimHandlingMode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function chooseAdjuster(input: RoutingInput, currentClaimId?: string): Promise<AdjusterAssignmentDecision> {
  const adjusters = await getAdjusterProfiles();
  const claims = await claimsRepo.findAll().catch(() => [] as Claim[]);
  const byId = new Map(adjusters.map((adjuster) => [adjuster.id, adjuster]));

  const serviceTier = await resolveServiceTier({
    personaId: input.claimantPersonaId,
    claimantName: input.claimantName,
  });
  const handlingMode = handlingModeForTier(serviceTier);
  const isWhiteGlove = serviceTier === 'white_glove' || serviceTier === 'signature';

  const priorClaim = claims.find(
    (claim) =>
      claim.id !== currentClaimId &&
      claim.claimantName.trim().toLowerCase() === input.claimantName.trim().toLowerCase() &&
      claim.assignedAdjusterId &&
      byId.has(claim.assignedAdjusterId)
  );
  if (priorClaim?.assignedAdjusterId) {
    const repeatAdjuster = byId.get(priorClaim.assignedAdjusterId)!;
    // White Glove clients must stay with a senior human adjuster — continuity
    // only wins when the prior adjuster is already senior enough.
    if (!isWhiteGlove || isSeniorAdjuster(repeatAdjuster)) {
      return {
        adjuster: repeatAdjuster,
        confidence: 0.96,
        signals: [
          `Previous claimant history matched earlier claim ${priorClaim.id}`,
          `Returning claimant retained with ${repeatAdjuster.name} for continuity`,
          ...(isWhiteGlove ? [tierSignal(serviceTier)] : []),
        ],
        reason: isWhiteGlove
          ? `Retained senior adjuster ${repeatAdjuster.name} for white-glove continuity.`
          : `Matched prior claimant history and kept continuity with ${repeatAdjuster.name}.`,
        serviceTier,
        handlingMode,
      };
    }
    // else: prior adjuster is junior — fall through and re-route to a senior.
  }

  const text = `${input.incidentDescription} ${input.incidentLocation} ${input.partiesInvolved.map((party) => party.role).join(' ')}`.toLowerCase();
  const basePriority = makePriorityFromSubmission({
    claimantName: input.claimantName,
    incidentType: 'Auto',
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentLocation: input.incidentLocation,
    partiesInvolved: input.partiesInvolved,
    injuryIndicated: input.injuryIndicated,
    immediateNeeds: [],
    preferredContactChannel: 'Phone',
    incidentDescription: input.incidentDescription,
  });

  const scoreByAdjuster = new Map<string, number>();
  const signalsByAdjuster = new Map<string, string[]>();

  for (const adjuster of adjusters) {
    let score = (adjuster.maxCapacity - adjuster.currentWorkload) * 2;
    const signals: string[] = [];
    signals.push(`${adjuster.maxCapacity - adjuster.currentWorkload} slots free in current workload`);

    if (input.injuryIndicated) {
      if (adjuster.id === 'adj_pemberton') score += 24;
      if (adjuster.id === 'adj_chen') score += 16;
      if (adjuster.id === 'adj_pemberton' || adjuster.id === 'adj_chen') {
        signals.push('Injury indicators matched injury-capable adjuster expertise');
      }
    }

    if (keywordScore(text, [/(fraud|staged|untraced|fleeing|ghost passenger|siu)/])) {
      if (adjuster.id === 'adj_patel') score += 30;
      if (adjuster.id === 'adj_patel') signals.push('Fraud/SIU signals matched specialist handling');
    }

    if (keywordScore(text, [/(fleet|commercial|logistics|hgv|van|cargo|mib)/])) {
      if (adjuster.id === 'adj_chen') score += 28;
      if (adjuster.id === 'adj_patel') score += 10;
      if (adjuster.id === 'adj_chen' || adjuster.id === 'adj_patel') {
        signals.push('Commercial or fleet wording matched complex motor specialists');
      }
    }

    if (keywordScore(text, [/(prestige|rolls|porsche|mclaren|ferrari|lamborghini|bentley|agreed value|total loss)/])) {
      if (adjuster.id === 'adj_chen') score += 26;
      if (adjuster.id === 'adj_patel') score += 10;
      if (adjuster.id === 'adj_chen' || adjuster.id === 'adj_patel') {
        signals.push('Prestige or major-loss wording matched high-value authority');
      }
    }

    if (!input.injuryIndicated && basePriority === 'normal') {
      if (adjuster.id === 'adj_whitfield') score += 16;
      if (adjuster.id === 'adj_blackwood') score += 12;
      if (adjuster.id === 'adj_ashworth') score += 8;
      if (adjuster.id === 'adj_whitfield' || adjuster.id === 'adj_blackwood' || adjuster.id === 'adj_ashworth') {
        signals.push('Standard auto loss routed to core motor queue');
      }
    }

    if (basePriority === 'high' || basePriority === 'urgent') {
      if (adjuster.id === 'adj_patel') score += 8;
      if (adjuster.id === 'adj_chen') score += 10;
      if (adjuster.id === 'adj_blackwood') score -= 6;
      if (adjuster.id === 'adj_patel' || adjuster.id === 'adj_chen') {
        signals.push('High-priority exposure favoured senior authority');
      }
    }

    if (adjuster.currentWorkload >= adjuster.maxCapacity) {
      score -= 20;
      signals.push('At capacity penalty applied');
    }

    score += adjuster.yearsExperience / 10;
    signals.push(`${adjuster.yearsExperience} years experience contributed to tie-break`);
    signalsByAdjuster.set(adjuster.id, signals);
    scoreByAdjuster.set(adjuster.id, score);
  }

  // Build the eligible candidate pool. White Glove clients are restricted to
  // senior+ adjusters (never Junior); the rest consider everyone. Within the
  // pool, prefer adjusters with spare capacity, then highest score.
  let capacityException = false;
  let pool = adjusters;
  if (isWhiteGlove) {
    const seniors = adjusters.filter(isSeniorAdjuster);
    if (seniors.length > 0) {
      const seniorsWithCapacity = seniors.filter((a) => a.currentWorkload < a.maxCapacity);
      if (seniorsWithCapacity.length > 0) {
        pool = seniorsWithCapacity;
      } else {
        pool = seniors;
        capacityException = true;
      }
    }
  }

  const ranked = [...pool].sort(
    (a, b) => (scoreByAdjuster.get(b.id) ?? Number.NEGATIVE_INFINITY) - (scoreByAdjuster.get(a.id) ?? Number.NEGATIVE_INFINITY)
  );

  const adjuster = ranked[0] ?? adjusters[0] ?? profileWithoutRole(BUILTIN_ADJUSTERS[0]);
  const bestScore = scoreByAdjuster.get(adjuster.id) ?? 0;
  const secondBestScore = ranked.length > 1 ? scoreByAdjuster.get(ranked[1].id) ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;

  const baseSignals = signalsByAdjuster.get(adjuster.id) ?? [];
  const tierSignals: string[] = [tierSignal(serviceTier)];
  if (isWhiteGlove) {
    tierSignals.push(`Routed to ${adjuster.seniority} adjuster ${adjuster.name} (human-handled).`);
    if (capacityException) {
      tierSignals.push('Capacity exception: all senior adjusters at capacity — assigned least-loaded senior.');
    }
  }
  const signals = [...tierSignals, ...baseSignals];

  const margin = Number.isFinite(secondBestScore) ? Math.max(0, bestScore - secondBestScore) : 18;
  let confidence = clamp(0.6 + margin / 60 + Math.min(signals.length, 4) * 0.03, 0.62, 0.97);
  if (isWhiteGlove && !capacityException) {
    confidence = Math.max(confidence, 0.9);
  }
  const topSignals = signals.filter(Boolean).slice(0, 4);

  return {
    adjuster,
    confidence: Number(confidence.toFixed(2)),
    signals: topSignals,
    reason: isWhiteGlove
      ? `White-glove client routed to senior adjuster ${adjuster.name} for human handling.`
      : topSignals.length
        ? topSignals.slice(0, 2).join('. ') + '.'
        : `Balanced ${adjuster.name}'s motor expertise against current workload.`,
    serviceTier,
    handlingMode,
  };
}

export async function assignAdjuster(submission: FNOLSubmission): Promise<AdjusterProfile> {
  return (await chooseAdjuster(submission)).adjuster;
}

export async function assignAdjusterDecision(submission: FNOLSubmission): Promise<AdjusterAssignmentDecision> {
  return chooseAdjuster(submission);
}

export async function ensureAssignedAdjuster(claim: Claim): Promise<Claim> {
  // Already routed: keep the existing adjuster but backfill tier/handling mode
  // for claims created before these fields existed.
  if (claim.assignedAdjusterId && claim.assignedAdjusterName && claim.owner) {
    if (claim.handlingMode && claim.clientServiceTier) {
      return claim;
    }
    const serviceTier = await resolveServiceTier({
      personaId: claim.claimantPersonaId,
      claimantName: claim.claimantName,
    });
    const backfilled: Claim = {
      ...claim,
      clientServiceTier: serviceTier,
      handlingMode: handlingModeForTier(serviceTier),
    };
    await claimsRepo.upsert(backfilled);
    return backfilled;
  }

  const decision = await chooseAdjuster(
    {
      claimantName: claim.claimantName,
      claimantPersonaId: claim.claimantPersonaId,
      incidentLocation: claim.incidentLocation,
      partiesInvolved: claim.partiesInvolved,
      injuryIndicated: claim.injuryIndicated,
      incidentDescription: claim.incidentDescription,
    },
    claim.id
  );
  const adjuster = decision.adjuster;

  const updatedClaim: Claim = {
    ...claim,
    assignedAdjusterId: adjuster.id,
    assignedAdjusterName: adjuster.name,
    assignmentReason: decision.reason,
    assignmentConfidence: decision.confidence,
    assignmentSignals: decision.signals,
    clientServiceTier: decision.serviceTier,
    handlingMode: decision.handlingMode,
    owner: ownerName(adjuster.name),
  };

  await claimsRepo.upsert(updatedClaim);
  return updatedClaim;
}
