import type { Claim, EvidenceItem } from '../types';
import type { EvidenceItem as SessionEvidenceItem } from '../types/fnolSession';
import { getSessionByClaimId } from './fnolSessionService';
import { BlobStorageFactory } from './blobStorageService';

type HighlightZone =
  | 'front-left'
  | 'front-center'
  | 'front-right'
  | 'left-side'
  | 'right-side'
  | 'rear-left'
  | 'rear-center'
  | 'rear-right'
  | 'windshield'
  | 'hood'
  | 'trunk'
  | 'roof';

type DamageSeverity = 'minor' | 'moderate' | 'severe';
type EvidenceStrength = 'strong' | 'mixed' | 'weak';
type AnalysisSource = 'vision' | 'heuristic';
type HighlightAnchor =
  | 'upper-left'
  | 'upper-center'
  | 'upper-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'lower-left'
  | 'lower-center'
  | 'lower-right';

type DamageHighlight = {
  id: string;
  label: string;
  zone: HighlightZone;
  point: { x: number; y: number };
  severity: DamageSeverity;
  confidence: number;
  rationale: string;
  bounds: { x: number; y: number; width: number; height: number };
};

type RepairEstimateLine = {
  label: string;
  reason: string;
  minAmount: number;
  maxAmount: number;
};

type EvidenceReviewResult = {
  reviewKind: 'damage_photo' | 'document_image';
  imageUrl?: string;
  filename: string;
  source: string;
  selectedEvidenceReview: {
    summary: string;
    findings: string[];
    analysisSource: AnalysisSource;
    fallbackUsed: boolean;
  };
  discrepancies: string[];
  damageHighlights: DamageHighlight[];
  evidenceValidity: {
    overall: EvidenceStrength;
    summary: string;
    corroboratingSignals: string[];
    concerns: string[];
  };
  repairEstimate: {
    currency: 'USD';
    totalMin: number;
    totalMax: number;
    lineItems: RepairEstimateLine[];
    assumptions: string[];
  };
  claimWideAssessment: {
    summary: string;
    evidenceConsidered: number;
    supportingEvidence: string[];
    missingEvidence: string[];
    recommendations: string[];
  };
};

const blobStorage = BlobStorageFactory.create();

const ZONE_BOUNDS: Record<HighlightZone, DamageHighlight['bounds']> = {
  'front-left': { x: 0.08, y: 0.22, width: 0.24, height: 0.28 },
  'front-center': { x: 0.34, y: 0.2, width: 0.3, height: 0.26 },
  'front-right': { x: 0.66, y: 0.22, width: 0.24, height: 0.28 },
  'left-side': { x: 0.05, y: 0.3, width: 0.22, height: 0.34 },
  'right-side': { x: 0.73, y: 0.3, width: 0.22, height: 0.34 },
  'rear-left': { x: 0.08, y: 0.56, width: 0.24, height: 0.24 },
  'rear-center': { x: 0.34, y: 0.58, width: 0.3, height: 0.2 },
  'rear-right': { x: 0.66, y: 0.56, width: 0.24, height: 0.24 },
  windshield: { x: 0.3, y: 0.08, width: 0.4, height: 0.18 },
  hood: { x: 0.28, y: 0.22, width: 0.44, height: 0.18 },
  trunk: { x: 0.3, y: 0.63, width: 0.4, height: 0.16 },
  roof: { x: 0.28, y: 0.02, width: 0.44, height: 0.12 },
};

function getFoundryBaseEndpoint(): string | null {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (!endpoint) return null;
  return endpoint.replace(/\/$/, '').split('/api/projects/')[0];
}

function buildImageUrl(sessionEvidence: SessionEvidenceItem, fallback?: string): string | undefined {
  const storedFile = sessionEvidence.blobName?.split('/').pop();
  if (sessionEvidence.sessionId && storedFile) {
    return `/api/v1/fnol/evidence-files/${encodeURIComponent(sessionEvidence.sessionId)}/${encodeURIComponent(storedFile)}`;
  }
  return fallback;
}

function getVisionDeployment(): string | null {
  const deployment = process.env.FOUNDRY_VISION_DEPLOYMENT?.trim();
  return deployment || null;
}

function isHighlightAnchor(value: unknown): value is HighlightAnchor {
  return value === 'upper-left'
    || value === 'upper-center'
    || value === 'upper-right'
    || value === 'center-left'
    || value === 'center'
    || value === 'center-right'
    || value === 'lower-left'
    || value === 'lower-center'
    || value === 'lower-right';
}

function pointFromZoneAnchor(zone: HighlightZone, anchor: HighlightAnchor): { x: number; y: number } {
  const bounds = ZONE_BOUNDS[zone];
  const [row, col] = anchor.split('-') as [string, string?];
  const vertical = row === 'upper' ? 0.25 : row === 'lower' ? 0.75 : 0.5;
  const horizontal = col === 'left' ? 0.25 : col === 'right' ? 0.75 : 0.5;

  return {
    x: bounds.x + (bounds.width * horizontal),
    y: bounds.y + (bounds.height * vertical),
  };
}

function pointFromComponent(zone: HighlightZone, label: string, anchor: HighlightAnchor): { x: number; y: number } {
  const text = label.toLowerCase();
  const bounds = ZONE_BOUNDS[zone];
  const absolutePoint = (x: number, y: number) => ({ x, y });
  const componentPoint = (x: number, y: number) => ({
    x: bounds.x + (bounds.width * x),
    y: bounds.y + (bounds.height * y),
  });

  if (/tail\s?light|tail\s?lamp|taillight|taillamp|rear lamp/.test(text)) {
    if (zone === 'rear-left') return absolutePoint(0.17, 0.46);
    if (zone === 'rear-right') return absolutePoint(0.60, 0.46);
  }

  if (/trunk|deck lid|rear panel|rear body|license plate/.test(text)) {
    if (/trunk|deck lid/.test(text)) return absolutePoint(0.48, 0.43);
    if (zone === 'rear-left') return absolutePoint(0.29, 0.58);
    if (zone === 'rear-center' || zone === 'trunk') return absolutePoint(0.48, 0.56);
    if (zone === 'rear-right') return absolutePoint(0.60, 0.58);
  }

  if (/bumper|valance|fascia/.test(text)) {
    if (zone === 'rear-left') return absolutePoint(0.28, 0.63);
    if (zone === 'rear-center') return absolutePoint(0.49, 0.66);
    if (zone === 'rear-right') return absolutePoint(0.60, 0.64);
    if (zone === 'front-left') return absolutePoint(0.26, 0.58);
    if (zone === 'front-center') return absolutePoint(0.48, 0.56);
    if (zone === 'front-right') return absolutePoint(0.67, 0.58);
  }

  if (/quarter panel|fender|wheel arch/.test(text)) {
    if (zone === 'rear-left' || zone === 'left-side') return absolutePoint(0.29, 0.56);
    if (zone === 'rear-right' || zone === 'right-side') return absolutePoint(0.63, 0.56);
  }

  return pointFromZoneAnchor(zone, anchor);
}

function severityFromText(text: string): DamageSeverity {
  if (/(structural|crumpled|collapsed|severe|deployed|shattered)/.test(text)) return 'severe';
  if (/(dent|creased|misaligned|cracked|broken)/.test(text)) return 'moderate';
  return 'minor';
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function inferDocumentCategory(
  selectedEvidence: EvidenceItem,
  sessionEvidence?: SessionEvidenceItem,
): SessionEvidenceItem['category'] {
  if (sessionEvidence?.category) return sessionEvidence.category;
  const text = `${selectedEvidence.type} ${selectedEvidence.source} ${selectedEvidence.description}`.toLowerCase();
  if (/witness|statement/.test(text)) return 'witness_statement';
  if (/police|incident report|collision report|crash report/.test(text)) return 'police_report';
  if (/medical|\ber\b|emergency room|hospital|clinic|doctor|visit notes/.test(text)) return 'medical_record';
  return 'other';
}

function isDocumentStyleEvidence(selectedEvidence: EvidenceItem, sessionEvidence?: SessionEvidenceItem): boolean {
  if (!sessionEvidence) return true;
  if (sessionEvidence.type === 'document') return true;
  if (sessionEvidence.category === 'medical_record' || sessionEvidence.category === 'witness_statement' || sessionEvidence.category === 'police_report') return true;
  if (sessionEvidence.mimeType && !sessionEvidence.mimeType.startsWith('image/')) return true;
  const text = `${selectedEvidence.type} ${selectedEvidence.source} ${selectedEvidence.description}`.toLowerCase();
  return /witness|statement|police|report|medical|\ber\b|hospital|notes|record/.test(text);
}

function evidenceText(item: EvidenceItem): string {
  return `${item.type} ${item.description} ${item.source}`.toLowerCase();
}

function isPoliceDocument(item: EvidenceItem): boolean {
  return /police report|incident report|collision report|crash report/.test(evidenceText(item));
}

function isWitnessStatement(item: EvidenceItem): boolean {
  return /witness/.test(evidenceText(item));
}

function isMedicalDocument(item: EvidenceItem): boolean {
  return /medical|\ber\b|emergency room|hospital|urgent care|clinic/.test(evidenceText(item));
}

function detectReportedImpact(claim: Claim): 'rear' | 'front' | 'side' | null {
  const text = `${claim.incidentDescription} ${claim.blockerReason}`.toLowerCase();
  if (/(rear[- ]?end|rear[- ]?ended|hit from behind|struck from behind|rear impact|shunted from behind)/.test(text)) {
    return 'rear';
  }
  if (/(front[- ]?end|front impact|hit a wall|hit the barrier|ran into)/.test(text)) {
    return 'front';
  }
  if (/(side impact|side[- ]?swipe|sideswipe|t-bone|tbone|driver side|passenger side)/.test(text)) {
    return 'side';
  }
  return null;
}

function detectVisibleDamagePattern(highlights: DamageHighlight[]): { rear: boolean; front: boolean; side: boolean } {
  return {
    rear: highlights.some((item) => item.zone === 'rear-left' || item.zone === 'rear-center' || item.zone === 'rear-right' || item.zone === 'trunk'),
    front: highlights.some((item) => item.zone === 'front-left' || item.zone === 'front-center' || item.zone === 'front-right' || item.zone === 'hood'),
    side: highlights.some((item) => item.zone === 'left-side' || item.zone === 'right-side'),
  };
}

function buildConsistencyFinding(claim: Claim, highlights: DamageHighlight[]): string {
  const reportedImpact = detectReportedImpact(claim);
  const visiblePattern = detectVisibleDamagePattern(highlights);

  if (reportedImpact === 'rear') {
    if (visiblePattern.rear) {
      return 'The visible rear-area damage is broadly consistent with the reported rear-impact account.';
    }
    if (visiblePattern.front) {
      return 'The current image does not obviously match a rear-impact account and should be checked against the written statements and reports.';
    }
  }

  if (reportedImpact === 'front') {
    if (visiblePattern.front) {
      return 'The visible front-area damage is broadly consistent with the reported front-impact account.';
    }
    if (visiblePattern.rear) {
      return 'The current image does not obviously match a front-impact account and should be checked against the written statements and reports.';
    }
  }

  if (reportedImpact === 'side') {
    if (visiblePattern.side) {
      return 'The visible side-area damage is broadly consistent with the reported side-impact account.';
    }
    if (visiblePattern.rear || visiblePattern.front) {
      return 'The current image shows damage, but the pattern should be checked against the reported side-impact account.';
    }
  }

  return 'The visible damage can be assessed against the reported incident, but this image alone does not establish the full impact sequence.';
}

function buildRecordedSupportSignals(claim: Claim): string[] {
  const evidenceItems = claim.evidenceItems ?? [];
  return dedupeStrings([
    ...evidenceItems
      .filter((item) => item.provenance === 'Public Record' || item.provenance === 'Third Party' || item.status === 'verified')
      .map((item) => `${item.type} from ${item.source}`),
    ...evidenceItems
      .filter(isPoliceDocument)
      .map((item) => `Police report uploaded from ${item.source}${item.status === 'pending' ? ' (official record, verification pending)' : ''}`),
    ...evidenceItems
      .filter(isWitnessStatement)
      .map((item) => `Witness statement uploaded from ${item.source}${item.status === 'pending' ? ' (statement on file, verification pending)' : ''}`),
    ...evidenceItems
      .filter(isMedicalDocument)
      .map((item) => `Medical / ER document uploaded from ${item.source}${item.status === 'pending' ? ' (record on file, verification pending)' : ''}`),
    claim.policeReportRef ? `Police reference on file (${claim.policeReportRef})` : '',
  ]);
}

function buildRecordContextFindings(claim: Claim): string[] {
  const evidenceItems = claim.evidenceItems ?? [];
  const policeDoc = evidenceItems.find(isPoliceDocument);
  const witnessCount = evidenceItems.filter(isWitnessStatement).length;
  const medicalCount = evidenceItems.filter(isMedicalDocument).length;

  return dedupeStrings([
    policeDoc ? `A police report is on file from ${policeDoc.source}; use it alongside this image when confirming the impact sequence.` : '',
    !policeDoc && claim.policeReportRef ? `A police reference is on file (${claim.policeReportRef}); match this image against the official incident record when it is reviewed.` : '',
    witnessCount > 0 ? `${witnessCount} witness statement${witnessCount === 1 ? ' is' : 's are'} on file and should be read alongside the image review.` : '',
    medicalCount > 0 ? `${medicalCount} medical / ER document${medicalCount === 1 ? ' is' : 's are'} on file for the wider injury picture.` : '',
  ]);
}

function buildDiscrepancies(
  claim: Claim,
  selectedEvidence: EvidenceItem,
  sessionEvidence: SessionEvidenceItem,
  highlights: DamageHighlight[],
): string[] {
  const issues: string[] = [];
  const text = `${claim.incidentDescription} ${claim.blockerReason}`.toLowerCase();
  const visiblePattern = detectVisibleDamagePattern(highlights);

  if (visiblePattern.front && /(rear[- ]?end|rear[- ]?ended|hit from behind|struck from behind|rear impact)/.test(text)) {
    issues.push('The selected image shows front-end damage, which does not obviously match the reported rear-impact account.');
  }
  if (visiblePattern.rear && /(front[- ]?end|front impact|hit a wall|ran into)/.test(text)) {
    issues.push('The selected image shows rear-area damage, which does not obviously match the reported front-impact account.');
  }
  if (selectedEvidence.status === 'pending') {
    issues.push('This artifact is still pending verification, so any conclusion from it should be treated as provisional.');
  }
  if (sessionEvidence.category === 'witness_statement') {
    issues.push('Witness statements can support chronology, but they do not independently settle liability on their own.');
  }
  if (sessionEvidence.category === 'medical_record') {
    issues.push('Medical records can support injury reporting, but they do not by themselves confirm how the collision occurred.');
  }
  if (sessionEvidence.category === 'police_report' && selectedEvidence.status === 'pending') {
    issues.push('An official report image is on file, but it still needs verification before it can be treated as confirmed record content.');
  }

  return dedupeStrings(issues);
}

function buildDocumentImageReview(
  claim: Claim,
  selectedEvidence: EvidenceItem,
  sessionEvidence: Pick<SessionEvidenceItem, 'category' | 'filename' | 'mimeType'>,
  imageUrl?: string,
): EvidenceReviewResult {
  const hasRenderableImage = Boolean(imageUrl && sessionEvidence.mimeType?.startsWith('image/'));
  const resolvedImageUrl = hasRenderableImage ? imageUrl : undefined;
  const category = inferDocumentCategory(selectedEvidence, sessionEvidence as SessionEvidenceItem);
  const categoryLabel =
    category === 'medical_record'
      ? 'medical / ER record'
      : category === 'witness_statement'
        ? 'witness statement'
        : category === 'police_report'
          ? 'police / incident report'
          : 'supporting document';

  const findings = dedupeStrings([
    resolvedImageUrl
      ? `This upload should be read as a ${categoryLabel}, not as a vehicle-damage photo.`
      : `This upload should be read as a ${categoryLabel}. No renderable image is available, so this is a metadata-first review.`,
    category === 'police_report'
      ? 'Treat it as an official record image when checking the incident sequence and parties involved.'
      : '',
    category === 'witness_statement'
      ? 'Use it to cross-check the narrative, chronology, and any mismatch with the damage photos.'
      : '',
    category === 'medical_record'
      ? 'Use it to confirm treatment timing and reported symptoms against the wider claim narrative.'
      : '',
    ...buildRecordContextFindings(claim),
  ]);

  return {
    reviewKind: 'document_image',
    imageUrl: resolvedImageUrl,
    filename: sessionEvidence.filename || selectedEvidence.source,
    source: selectedEvidence.source,
    selectedEvidenceReview: {
      summary: resolvedImageUrl
        ? `This image appears to be a ${categoryLabel}. Review it as supporting record content rather than as a damage-visual analysis target.`
        : `This artifact appears to be a ${categoryLabel}. Review it as supporting record content rather than as a damage-visual analysis target.`,
      findings,
      analysisSource: 'heuristic',
      fallbackUsed: true,
    },
    discrepancies: buildDiscrepancies(claim, selectedEvidence, sessionEvidence as SessionEvidenceItem, []),
    damageHighlights: [],
    evidenceValidity: buildEvidenceValidity(claim),
    repairEstimate: {
      currency: 'USD',
      totalMin: 0,
      totalMax: 0,
      lineItems: [],
      assumptions: [],
    },
    claimWideAssessment: buildClaimWideAssessment(claim),
  };
}

function buildDamageFallbackReview(
  claim: Claim,
  selectedEvidence: EvidenceItem,
  sessionEvidence: SessionEvidenceItem,
  imageUrl: string,
  reason: string,
): EvidenceReviewResult {
  return {
    reviewKind: 'damage_photo',
    imageUrl,
    filename: sessionEvidence.filename || selectedEvidence.source,
    source: selectedEvidence.source,
    selectedEvidenceReview: {
      summary: `Damage-photo review fallback: ${reason}`,
      findings: dedupeStrings([
        'Automated damage-visual review was unavailable for this artifact in this pass.',
        'This result is still useful for discrepancy checks, but no damage anchors were generated.',
        ...buildRecordContextFindings(claim),
      ]),
      analysisSource: 'heuristic',
      fallbackUsed: true,
    },
    discrepancies: dedupeStrings([
      ...buildDiscrepancies(claim, selectedEvidence, sessionEvidence, []),
      'No AI damage anchors were produced in this pass; keep this as provisional.',
    ]),
    damageHighlights: [],
    evidenceValidity: buildEvidenceValidity(claim),
    repairEstimate: {
      currency: 'USD',
      totalMin: 0,
      totalMax: 0,
      lineItems: [],
      assumptions: [],
    },
    claimWideAssessment: buildClaimWideAssessment(claim),
  };
}

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function runVisionReview(
  claim: Claim,
  evidence: EvidenceItem,
  sessionEvidence: SessionEvidenceItem,
  allEvidence: EvidenceItem[],
  imageBuffer: Buffer,
): Promise<{
  summary: string;
  findings: string[];
  damageHighlights: DamageHighlight[];
  analysisSource: AnalysisSource;
  fallbackUsed: boolean;
}> {
  const endpoint = getFoundryBaseEndpoint();
  const apiKey = process.env.FOUNDRY_API_KEY;
  const deployment = getVisionDeployment();
  const mimeType = sessionEvidence.mimeType || 'image/png';

  if (!endpoint || !apiKey || !deployment) {
    throw Object.assign(
      new Error('Evidence review requires FOUNDRY_PROJECT_ENDPOINT, FOUNDRY_API_KEY, and FOUNDRY_VISION_DEPLOYMENT in .env.'),
      { status: 503 }
    );
  }

  const evidenceContext = allEvidence
    .map((item) => `- ${item.type}: ${item.description} (${item.status}, ${item.provenance})`)
    .join('\n');

  const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are an Evidence Review Agent for US auto claims. Review the selected image and the claim evidence context. Return JSON only with keys: summary (string), findings (string array), damageAreas (array). Each damageAreas item must have label, zone, anchor, severity, confidence, rationale. zone must be one of: front-left, front-center, front-right, left-side, right-side, rear-left, rear-center, rear-right, windshield, hood, trunk, roof. anchor must be one of: upper-left, upper-center, upper-right, center-left, center, center-right, lower-left, lower-center, lower-right, and it must describe where inside that zone the visible damage sits. Keep the anchor on the damaged vehicle panel itself, never on the road or background. severity must be minor, moderate, or severe. Prefer 2-4 separate visible damage areas when the image shows multiple damaged components, especially bumper, trunk/rear panel, lamp/corner, quarter panel, and lower valance areas. Keep outputs conservative and clearly tied to visible evidence.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Claim ${claim.id} for ${claim.claimantName}. Incident: ${claim.incidentDescription}\nSelected evidence: ${evidence.type} from ${evidence.source}\nAll evidence:\n${evidenceContext}`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`, detail: 'high' },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`Evidence Review Agent vision call returned ${response.status}: ${errorText}`);
    throw Object.assign(
      new Error(`Evidence Review Agent failed with ${response.status}: ${errorText}`),
      { status: 502 }
    );
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content?.trim() || '';
  const jsonBlock = extractJsonBlock(raw);
  if (!jsonBlock) {
    throw Object.assign(
      new Error('Evidence Review Agent returned a non-JSON response.'),
      { status: 502 }
    );
  }

  let parsed: {
    summary?: string;
    findings?: string[];
    damageAreas?: Array<{
      label?: string;
      zone?: HighlightZone;
      anchor?: HighlightAnchor;
      severity?: DamageSeverity;
      confidence?: number;
      rationale?: string;
    }>;
  };
  try {
    parsed = JSON.parse(jsonBlock) as {
      summary?: string;
      findings?: string[];
      damageAreas?: Array<{
        label?: string;
        zone?: HighlightZone;
        anchor?: HighlightAnchor;
        severity?: DamageSeverity;
        confidence?: number;
        rationale?: string;
      }>;
    };
  } catch {
    throw Object.assign(
      new Error('Evidence Review Agent returned invalid JSON.'),
      { status: 502 }
    );
  }

  const highlights = (parsed.damageAreas ?? [])
    .map((area, index) => {
      if (!area.label || !area.zone || !ZONE_BOUNDS[area.zone] || !isHighlightAnchor(area.anchor)) {
        return null;
      }

      const normalizedZone = area.zone;
      const point = pointFromComponent(normalizedZone, area.label, area.anchor);

      return {
        id: `${evidence.id}-highlight-${index}`,
        label: area.label,
        zone: normalizedZone,
        point,
        severity: area.severity ?? severityFromText(`${area.label} ${area.rationale ?? ''}`),
        confidence: Math.min(0.99, Math.max(0.35, area.confidence ?? 0.72)),
        rationale: area.rationale ?? area.label,
        bounds: ZONE_BOUNDS[normalizedZone],
      };
    })
    .filter((item): item is DamageHighlight => Boolean(item));

  if (!highlights.length) {
    throw Object.assign(
      new Error('Evidence Review Agent returned no usable damage zone anchors for this image.'),
      { status: 502 }
    );
  }

  const summary = parsed.summary?.trim() || parsed.findings?.[0]?.trim();
  if (!summary) {
    throw Object.assign(
      new Error('Evidence Review Agent returned no summary for this image.'),
      { status: 502 }
    );
  }

  const findings = dedupeStrings([summary, ...(parsed.findings ?? []).map((item) => item.trim()).filter(Boolean)]);

  return {
    summary,
    findings,
    damageHighlights: highlights,
    analysisSource: 'vision',
    fallbackUsed: false,
  };
}

function buildRepairEstimate(summary: string, highlights: DamageHighlight[]): EvidenceReviewResult['repairEstimate'] {
  const text = `${summary} ${highlights.map((item) => item.label).join(' ')}`.toLowerCase();
  const lineItems: RepairEstimateLine[] = [];
  const addLineItem = (label: string, reason: string, minAmount: number, maxAmount: number) => {
    if (!lineItems.some((item) => item.label === label)) {
      lineItems.push({ label, reason, minAmount, maxAmount });
    }
  };

  const labels = highlights.map((item) => item.label.toLowerCase());
  const zones = new Set(highlights.map((item) => item.zone));
  const hasRearZone = highlights.some((item) => item.zone.startsWith('rear') || item.zone === 'trunk');
  const hasFrontZone = highlights.some((item) => item.zone.startsWith('front') || item.zone === 'hood');
  const hasTailLampZone = highlights.some((item) => item.zone === 'rear-left' || item.zone === 'rear-right');
  const hasRearPanelSignal = labels.some((label) => /trunk|rear panel|rear body|license plate|deck lid|rear corner/.test(label));
  const hasRearBumperSignal = labels.some((label) => /rear bumper|bumper impact|rear fascia|valance/.test(label))
    || (hasRearZone && labels.some((label) => /\bbumper\b/.test(label)));
  const hasFrontBumperSignal = labels.some((label) => /front bumper|front fascia|grille/.test(label))
    || (hasFrontZone && labels.some((label) => /\bbumper\b/.test(label)));
  const hasPaintSignal = /paint|scrape|scuff/.test(text);
  const hasQuarterPanelSignal = labels.some((label) => /quarter panel|wheel-arch|wheel arch|fender/.test(label));
  const hasSevereSignal = highlights.some((item) => item.severity === 'severe') || /structural|alignment|crumpled/.test(text);

  if (hasRearBumperSignal) {
    addLineItem('Replace rear bumper cover', 'Matched from visible damage signals: rear bumper impact.', 550, 1650);
  } else if (hasFrontBumperSignal) {
    addLineItem('Replace front bumper cover', 'Matched from visible damage signals: front bumper or fascia damage.', 500, 1500);
  }

  if (hasRearPanelSignal && hasRearZone) {
    addLineItem('Repair and refinish trunk lid / rear body panel', 'Matched from visible damage signals: trunk or rear body panel deformation.', 650, 1850);
  }

  if (hasTailLampZone || /tail\s?light|tail\s?lamp|taillight|taillamp|rear lamp/.test(text)) {
    addLineItem('Replace tail lamp assembly', 'Matched from visible damage signals: rear lamp or corner damage.', 275, 900);
  } else if (/headlight|headlamp/.test(text)) {
    addLineItem('Replace headlamp assembly', 'Matched from visible damage signals: front lamp damage.', 350, 1200);
  }

  if (hasQuarterPanelSignal && hasRearZone) {
    addLineItem('Repair and refinish rear quarter panel', 'Matched from visible damage signals: rear quarter panel or wheel-arch damage.', 600, 1900);
  } else if (hasQuarterPanelSignal) {
    addLineItem('Repair and refinish fender', 'Matched from visible damage signals: fender or wheel-arch damage.', 450, 1400);
  }

  if (hasPaintSignal) {
    addLineItem('Blend paint and adjacent panels', 'Matched from visible damage signals: scrape, scuff, or paint-transfer damage.', 350, 1100);
  }

  if (hasSevereSignal) {
    addLineItem('Structural alignment and calibration check', 'Matched from visible damage signals: possible structural or alignment involvement.', 300, 1250);
  }

  if (lineItems.length === 0) {
    if (hasRearZone || zones.has('trunk')) {
      addLineItem('Repair and refinish rear body panel area', 'Matched from AI-identified rear body damage.', 500, 1400);
    } else if (hasFrontZone || zones.has('hood')) {
      addLineItem('Repair and refinish front-end body panel area', 'Matched from AI-identified front-end damage.', 450, 1300);
    } else if (zones.has('left-side') || zones.has('right-side')) {
      addLineItem('Repair and refinish side body panel area', 'Matched from AI-identified side-impact damage.', 450, 1350);
    } else if (zones.has('windshield')) {
      addLineItem('Replace windshield', 'Matched from AI-identified glass damage.', 250, 700);
    } else if (zones.has('roof')) {
      addLineItem('Repair roof panel area', 'Matched from AI-identified roof damage.', 500, 1600);
    }
  }

  return {
    currency: 'USD',
    totalMin: lineItems.reduce((sum, item) => sum + item.minAmount, 0),
    totalMax: lineItems.reduce((sum, item) => sum + item.maxAmount, 0),
    lineItems,
    assumptions: [
      'Ranges are first-pass US body-shop estimates and exclude supplements discovered after teardown.',
      'Calibration, hidden structural damage, and paint blending can widen the final estimate.',
    ],
  };
}

function buildEvidenceValidity(claim: Claim): EvidenceReviewResult['evidenceValidity'] {
  const evidenceItems = claim.evidenceItems ?? [];
  const corroboratingSignals = buildRecordedSupportSignals(claim);
  const concerns = dedupeStrings([
    ...evidenceItems.filter((item) => item.status === 'pending').map((item) => `${item.type} from ${item.source} is still pending verification.`),
    ...evidenceItems.filter((item) => item.status === 'disputed').map((item) => `${item.type} from ${item.source} is disputed and needs reconciliation.`),
    corroboratingSignals.length === 0 ? 'The file still relies mainly on claimant-supplied material.' : '',
  ]);

  const overall: EvidenceStrength =
    concerns.some((item) => item.includes('disputed'))
      ? 'weak'
      : corroboratingSignals.length >= 2
        ? 'strong'
        : 'mixed';

  return {
    overall,
    summary:
      overall === 'strong'
        ? 'The file has meaningful corroboration beyond the uploaded photo.'
        : overall === 'mixed'
          ? corroboratingSignals.length > 0
            ? 'The file includes supporting records and can be assessed directionally, but some items still need confirmation before they can carry the decision on their own.'
            : 'The file is directionally useful, but parts of the evidence set still need confirmation.'
          : 'The first-pass review is usable for triage only and should not be treated as fully corroborated.',
    corroboratingSignals,
    concerns,
  };
}

function buildClaimWideAssessment(claim: Claim): EvidenceReviewResult['claimWideAssessment'] {
  const evidenceItems = claim.evidenceItems ?? [];
  const supportingEvidence = dedupeStrings(
    evidenceItems.map((item) => `${item.type}: ${item.source}`)
  );
  const missingEvidence = dedupeStrings([
    !evidenceItems.some((item) => /estimate|invoice|repair/i.test(item.type) || /estimate|invoice|repair/i.test(item.description)) ? 'A body shop repair estimate or supplement.' : '',
    !claim.policeReportRef && !evidenceItems.some((item) => /police|incident report/i.test(item.type)) ? 'Independent police or incident report details if available.' : '',
  ]);

  // ── Demo-claim authored summaries ────────────────────────────────────────
  if (claim.claimantName === 'Andre Coleman') {
    return {
      summary: `The evidence chain for this glass claim is **coherent and well-supported**. Photographs confirm windshield damage consistent with a road-debris impact. The FNOL transcript records an unprompted, detailed account of the incident location (I-75 SB, Exit 51). The **MDOT road maintenance log** — an independent public record — corroborates the presence of loose aggregate on that stretch on the date of loss, directly supporting the claimant's account. The repair quote from National Auto Glass Network is consistent with the damage scope. **No material contradictions have been identified across the chain.**`,
      evidenceConsidered: evidenceItems.length,
      supportingEvidence,
      missingEvidence: [],
      recommendations: [
        '**Authorise the repair quote** — the evidence chain is sufficient for settlement without further investigation.',
        'Confirm ADAS forward-camera recalibration is included in the authorised scope before repair commences.',
        'No further evidence collection is required for this claim type.',
      ],
    };
  }

  if (claim.claimantName === "Patricia O'Connor") {
    return {
      summary: `The evidence chain for this unattended vehicle damage claim is **partially complete and actively developing**. The Brookline PD report (BPD-2026-47291) confirms the incident date, location, and damage description, corroborating the claimant's account of a hit-and-run event. The Porsche of Brookline repair estimate ($4,984) is verified and consistent with photographs. **One critical item remains outstanding**: the CCTV footage request submitted to the retail centre property management. This footage may identify the responsible party and create a **third-party liability recovery opportunity**. **Settlement should not be finalised until the CCTV outcome is known.**`,
      evidenceConsidered: evidenceItems.length,
      supportingEvidence,
      missingEvidence: ['CCTV footage outcome from retail centre (Level 2 car park) — pending 5–7 business days.'],
      recommendations: [
        '**Chase CCTV footage status** with the retail centre property management before proceeding to settlement.',
        'If footage identifies the responsible party, **initiate third-party recovery** — do not settle directly until that opportunity is assessed.',
        'Conditional repair approval can be considered now to protect the Masterpiece client experience, subject to subrogation rights being preserved.',
        "Confirm OEM-parts specification is accepted under O'Connor's policy tier before instructing the dealer.",
      ],
    };
  }

  if (claim.claimantName === 'Rafael Santos') {
    return {
      summary: `The evidence chain for this comprehensive-peril flash-flood claim **requires policy interpretation review before settlement quantum can be determined**. The NOAA advisory (FLA-FF-2026-0614) independently corroborates the flash-flood event at the claimant's stated parking location, confirming water depths of **18–24 inches above kerb level** — consistent with the reported door-sill immersion and cabin ingress. The Mercedes-Benz of Miami preliminary assessment documents significant electrical, drivetrain, and interior damage with a preliminary estimate range of **$14,200–$21,400**. The assessor has explicitly flagged that the upper range approaches the vehicle's actual cash value (~$62,000), making **total-loss determination a live question** that must be resolved before repair can be authorised.`,
      evidenceConsidered: evidenceItems.length,
      supportingEvidence,
      missingEvidence: ['Full strip-down assessment from Mercedes-Benz of Miami (preliminary only received).', 'Total-loss threshold calculation against current ACV.'],
      recommendations: [
        '**Instruct Mercedes-Benz of Miami** to proceed with full strip-down assessment — preliminary estimate is insufficient to close the total-loss question.',
        '**Complete policy interpretation review** to confirm comprehensive-peril flood coverage position before communicating a settlement position to the claimant.',
        'Initiate total-loss threshold calculation: ACV ~$62,000; if final repair cost exceeds 75%, **total loss is the correct settlement path**.',
        '**Do not authorise repair commencement** until total-loss determination is confirmed — premature repair instruction could create coverage liability.',
        'Advise Rafael Santos of expected timeline — Premier-tier client, response standard applies.',
      ],
    };
  }

  // ── Generic fallback for portfolio claims ────────────────────────────────
  const pending  = evidenceItems.filter(e => e.status === 'pending');
  const disputed = evidenceItems.filter(e => e.status === 'disputed');
  const allVerified = pending.length === 0 && disputed.length === 0;

  const summary = allVerified
    ? `First-pass rollup across ${evidenceItems.length} evidence item(s) on ${claim.claimantName}'s claim. All recorded artifacts have been verified. The chain is consistent with the incident as reported.`
    : `First-pass rollup across ${evidenceItems.length} evidence item(s) on ${claim.claimantName}'s claim.${pending.length ? ` ${pending.length} item(s) are pending verification.` : ''}${disputed.length ? ` ${disputed.length} item(s) are disputed and require review.` : ''}`;

  const recommendations: string[] = [];
  if (disputed.length > 0) recommendations.push('Review disputed evidence items for contradictions before progressing to settlement.');
  if (pending.length > 0) recommendations.push('Chase outstanding pending evidence — settlement should not proceed until all items are resolved.');
  if (missingEvidence.length > 0) recommendations.push('Consider whether the identified evidence gaps materially affect the coverage decision.');
  if (recommendations.length === 0) recommendations.push('Evidence chain is complete. Proceed with adjuster review of the decision recommendation.');

  return {
    summary,
    evidenceConsidered: evidenceItems.length,
    supportingEvidence,
    missingEvidence,
    recommendations,
  };
}

export async function reviewClaimEvidence(claim: Claim, evidenceId: string): Promise<EvidenceReviewResult> {
  const selectedEvidence = claim.evidenceItems.find((item) => item.id === evidenceId);
  if (!selectedEvidence) {
    throw Object.assign(new Error(`Evidence '${evidenceId}' not found on claim '${claim.id}'`), { status: 404 });
  }

  const session = await getSessionByClaimId(claim.id);
  const sessionEvidence = session?.evidenceItems.find((item) => item.id === evidenceId);

  if (!sessionEvidence) {
    return buildDocumentImageReview(
      claim,
      selectedEvidence,
      {
        category: inferDocumentCategory(selectedEvidence),
        filename: selectedEvidence.source,
        mimeType: undefined,
      },
      selectedEvidence.url
    );
  }

  const imageUrl = buildImageUrl(sessionEvidence, selectedEvidence.url);
  if (isDocumentStyleEvidence(selectedEvidence, sessionEvidence)) {
    return buildDocumentImageReview(claim, selectedEvidence, sessionEvidence, imageUrl);
  }

  if (!imageUrl || !sessionEvidence.blobName || !sessionEvidence.containerName || !sessionEvidence.mimeType?.startsWith('image/')) {
    return buildDocumentImageReview(claim, selectedEvidence, sessionEvidence, imageUrl);
  }

  const buffer = await blobStorage.getFileBuffer(sessionEvidence.containerName, sessionEvidence.blobName);
  let visionReview: Awaited<ReturnType<typeof runVisionReview>>;
  try {
    visionReview = await runVisionReview(claim, selectedEvidence, sessionEvidence, claim.evidenceItems ?? [], buffer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Automated review call failed';
    console.warn(`Evidence review fallback for ${evidenceId}: ${reason}`);
    return buildDamageFallbackReview(claim, selectedEvidence, sessionEvidence, imageUrl, reason);
  }
  const consistencyFinding = buildConsistencyFinding(claim, visionReview.damageHighlights);
  const recordContextFindings = buildRecordContextFindings(claim);
  const enrichedFindings = dedupeStrings([
    consistencyFinding,
    ...recordContextFindings,
    ...visionReview.findings,
  ]);

  return {
    reviewKind: 'damage_photo',
    imageUrl,
    filename: sessionEvidence.filename || selectedEvidence.source,
    source: selectedEvidence.source,
    selectedEvidenceReview: {
      summary: `${visionReview.summary} ${consistencyFinding}`.trim(),
      findings: enrichedFindings,
      analysisSource: visionReview.analysisSource,
      fallbackUsed: visionReview.fallbackUsed,
    },
    discrepancies: buildDiscrepancies(claim, selectedEvidence, sessionEvidence, visionReview.damageHighlights),
    damageHighlights: visionReview.damageHighlights,
    evidenceValidity: buildEvidenceValidity(claim),
    repairEstimate: buildRepairEstimate(visionReview.summary, visionReview.damageHighlights),
    claimWideAssessment: buildClaimWideAssessment(claim),
  };
}
