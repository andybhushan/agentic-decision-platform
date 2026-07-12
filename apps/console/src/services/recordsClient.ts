// GET /api/records?industry=: the industry's subject records (bundled corpus + runtime
// intake), verbatim. Interpreting them (members, policies, vehicles) is the use-case
// experience's job; the platform just hands over the data. Shape mirrors GetRecords.cs.

import { resolveApiBase } from "./config";

export interface ClaimAddress {
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface ClaimPolicyholder {
  firstName?: string;
  lastName?: string;
  policyholderId?: string;
  contactPhone?: string;
  address?: ClaimAddress;
}

export interface ClaimPolicy {
  policyNumber?: string;
  policyType?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  coverages?: string[];
  deductibles?: Record<string, number>;
}

export interface ClaimVehicle {
  vin?: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
  vehicleId?: string;
}

export interface ClaimIncident {
  incidentType?: string;
  location?: { city?: string; state?: string; intersection?: string };
  narrative?: string;
  injuries?: boolean;
  thirdPartyInvolved?: boolean;
  policeReportFiled?: boolean;
  photos?: number;
}

export interface ClaimRecord {
  claimNumber?: string;
  fnolReceivedAt?: string;
  incidentDate?: string;
  channel?: string;
  policyholder?: ClaimPolicyholder;
  policy?: ClaimPolicy;
  vehicle?: ClaimVehicle;
  incident?: ClaimIncident;
  flags?: Record<string, boolean>;
  evidenceGroupId?: string;
  evidenceAssessment?: string;
  evidencePhotoCount?: number;
  [key: string]: unknown;
}

export interface RecordsResponse {
  industry: string;
  useCase: string;
  subjectIdField: string;
  records: ClaimRecord[];
  intake: Record<string, { receivedAt: string; channel?: string }>;
}

export async function fetchRecords(industry: string): Promise<RecordsResponse> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/records?industry=${encodeURIComponent(industry)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`fetchRecords: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as RecordsResponse;
}
