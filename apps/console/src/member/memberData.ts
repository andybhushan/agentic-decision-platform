// Derives the member universe from the claims records: who the policyholders are, their
// policy, vehicles, and claim history. This file is use-case experience logic (Meridian
// member portal); the platform shell never imports it.

import type { ClaimIncident, ClaimRecord, RecordsResponse } from "../services/recordsClient";

export interface MemberProfile {
  policyholderId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  policy: NonNullable<ClaimRecord["policy"]>;
  vehicles: NonNullable<ClaimRecord["vehicle"]>[];
  claims: ClaimRecord[];
}

export function deriveMembers(data: RecordsResponse): MemberProfile[] {
  const byId = new Map<string, MemberProfile>();
  for (const r of data.records) {
    const ph = r.policyholder;
    const id = ph?.policyholderId;
    if (!id) continue;
    let m = byId.get(id);
    if (!m) {
      m = {
        policyholderId: id,
        firstName: ph?.firstName ?? "",
        lastName: ph?.lastName ?? "",
        fullName: `${ph?.firstName ?? ""} ${ph?.lastName ?? ""}`.trim(),
        contactPhone: ph?.contactPhone,
        city: ph?.address?.city,
        state: ph?.address?.state,
        postalCode: ph?.address?.postalCode,
        policy: r.policy ?? {},
        vehicles: [],
        claims: [],
      };
      byId.set(id, m);
    }
    if (r.vehicle?.vehicleId && !m.vehicles.some((v) => v.vehicleId === r.vehicle?.vehicleId)) {
      m.vehicles.push(r.vehicle);
    }
    m.claims.push(r);
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export interface IncidentForm {
  incidentDate: string;
  incidentType: string;
  locationCity: string;
  locationState: string;
  intersection: string;
  narrative: string;
  injuries: boolean;
  thirdPartyInvolved: boolean;
  policeReportFiled: boolean;
  photos: number;
  vehicleId: string;
}

export const INCIDENT_TYPES = [
  "intersection-collision",
  "rear-end-collision",
  "parking-lot-incident",
  "single-vehicle-accident",
  "weather-hail-damage",
  "theft",
  "vandalism",
] as const;

// Assembles a full corpus-shaped claim record from the member's own profile plus the
// incident details. The subject id is assigned server-side; eval-hint fields ("expected")
// are corpus-only and deliberately absent.
export function buildClaimRecord(
  member: MemberProfile,
  form: IncidentForm,
  channel: string,
  evidenceGroupId?: string,
): ClaimRecord {
  const vehicle = member.vehicles.find((v) => v.vehicleId === form.vehicleId) ?? member.vehicles[0] ?? {};
  const incident: ClaimIncident = {
    incidentType: form.incidentType,
    location: {
      city: form.locationCity || member.city,
      state: form.locationState || member.state,
      intersection: form.intersection || undefined,
    },
    narrative: form.narrative,
    injuries: form.injuries,
    thirdPartyInvolved: form.thirdPartyInvolved,
    policeReportFiled: form.policeReportFiled,
    photos: form.photos,
  };
  return {
    fnolReceivedAt: new Date().toISOString(),
    incidentDate: new Date(form.incidentDate).toISOString(),
    channel,
    policyholder: {
      firstName: member.firstName,
      lastName: member.lastName,
      policyholderId: member.policyholderId,
      contactPhone: member.contactPhone,
      address: { city: member.city, state: member.state, postalCode: member.postalCode },
    },
    policy: member.policy,
    vehicle,
    incident,
    ...(evidenceGroupId ? { evidenceGroupId } : {}),
    flags: {
      potentialFraudIndicators: false,
      expectedLowConfidenceTriage: false,
      ambiguousCoverage: false,
    },
  };
}
