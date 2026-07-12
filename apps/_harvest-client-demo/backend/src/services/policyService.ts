import { CosmosRepository } from './cosmosRepository';

export interface PolicyVehicle {
  make: string;
  model: string;
  registration: string;
  year: number;
  colour: string;
  value?: number;
}

export interface PolicyConnectedDevices {
  dashcam?: {
    manufacturer: string;
    model: string;
    registeredApp?: string;
    vehicleReg?: string;
  };
  telematics?: {
    provider: string;
    vehicleReg?: string;
    appName?: string;
  };
}

export interface Policy {
  /** Cosmos document id — equals policyRef */
  id: string;
  policyRef: string;
  personaId?: string;
  policyType?: string;
  holderName: string;
  holderDob?: string;
  holderEmail?: string;
  holderPhone?: string;
  address?: string;
  coverageType: string;
  coverageActive: boolean;
  startDate: string;
  renewalDate: string;
  annualPremium?: number;
  excessAmount: number;
  noClaims: number;
  vehicles?: PolicyVehicle[];
  namedDrivers?: string[];
  namedInsured?: string[];
  connectedDevices?: PolicyConnectedDevices;
  buildingsValue?: number;
  contentsValue?: number;
  maxTripDuration?: number;
  notes?: string;
}

const repo = new CosmosRepository<Policy>('policies');

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function getPolicyByRef(policyRef: string): Promise<Policy | undefined> {
  // id === policyRef, so we can use a direct point read
  const p = await repo.findById(policyRef);
  return p ?? undefined;
}

export async function getPolicyByHolder(holderName: string): Promise<Policy | undefined> {
  const name = holderName.trim().toLowerCase();
  const all = await repo.findAll();
  return all.find((p) => p.holderName.toLowerCase() === name);
}

export async function getAllPoliciesByHolder(holderName: string): Promise<Policy[]> {
  const name = holderName.trim().toLowerCase();
  const all = await repo.findAll();
  return all.filter((p) => p.holderName.toLowerCase() === name);
}

export async function getAllPoliciesByPersona(personaId: string): Promise<Policy[]> {
  const all = await repo.findAll();
  return all.filter((p) => p.personaId === personaId);
}

export async function getPrimaryAutoPolicyByPersona(personaId: string): Promise<Policy | undefined> {
  const policies = await getAllPoliciesByPersona(personaId);
  return policies.find((policy) => /auto|motor/i.test(policy.policyType ?? '') || /auto|vehicle|collision|liability/i.test(policy.coverageType))
    ?? policies[0];
}

export async function getAllPolicies(): Promise<Policy[]> {
  return repo.findAll();
}

export async function createPolicy(policy: Omit<Policy, 'id'>): Promise<Policy> {
  const doc: Policy = { ...policy, id: policy.policyRef };
  return repo.upsert(doc);
}

export async function updatePolicy(policyRef: string, updates: Partial<Policy>): Promise<Policy | null> {
  const existing = await repo.findById(policyRef);
  if (!existing) return null;
  return repo.upsert({ ...existing, ...updates, id: policyRef, policyRef });
}

export async function deletePolicy(policyRef: string): Promise<boolean> {
  return repo.delete(policyRef);
}

/** Serialise a policy into a concise text block for injection into LLM context. */
export function formatPolicyContext(policy: Policy): string {
  const vehicles = (policy.vehicles ?? [])
    .map((v) => `    - ${v.year} ${v.make} ${v.model}, License Plate: ${v.registration}, Color: ${v.colour}`)
    .join('\n');
  const drivers = policy.namedDrivers?.join(', ') ?? policy.holderName;

  const cd = policy.connectedDevices;
  const deviceLines: string[] = [];
  if (cd?.dashcam) {
    deviceLines.push(
      `    - Dashcam: ${cd.dashcam.manufacturer} ${cd.dashcam.model}` +
      (cd.dashcam.vehicleReg ? ` (fitted to ${cd.dashcam.vehicleReg})` : '') +
      (cd.dashcam.registeredApp ? `, app: ${cd.dashcam.registeredApp}` : '')
    );
  }
  if (cd?.telematics) {
    deviceLines.push(
      `    - Telematics: ${cd.telematics.provider}` +
      (cd.telematics.vehicleReg ? ` (vehicle: ${cd.telematics.vehicleReg})` : '') +
      (cd.telematics.appName ? `, app: ${cd.telematics.appName}` : '')
    );
  }
  const devicesBlock = deviceLines.length
    ? `  Connected Devices on File:\n${deviceLines.join('\n')}`
    : '  Connected Devices on File: None registered';

  return `CALLER POLICY RECORD:
  Policy Number : ${policy.policyRef}
  Policy Holder : ${policy.holderName}
  Coverage Type : ${policy.coverageType}${policy.coverageActive ? ' (ACTIVE)' : ' (INACTIVE)'}
  Deductible    : ${formatUsd(policy.excessAmount)}
  Claim-Free    : ${policy.noClaims} year(s)
  Renewal Date  : ${policy.renewalDate}
  Named Drivers : ${drivers}
${vehicles ? `  Insured Vehicles:\n${vehicles}\n` : ''}${devicesBlock}
  Notes: ${policy.notes ?? 'None'}`;
}
