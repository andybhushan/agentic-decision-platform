/**
 * FNOLGateCard — Inline consent, evidence, callback, and summary cards
 * rendered inside the conversation at gate-transition moments.
 */

import { useState, useRef } from 'react';
import { Button, TextInput, InlineNotification } from '@carbon/react';
import { Checkmark, Upload, Calendar, DocumentView, Camera, ChartLineData } from '@carbon/icons-react';
import type { ConsentArtifact, EvidenceItem } from '../../domain/fnol/types';
import './FNOLGateCard.scss';

// ── Consent card ──────────────────────────────────────────────────────────────

interface ConsentCardProps {
  consentType: ConsentArtifact['consentType'];
  onConsent: (type: ConsentArtifact['consentType']) => void;
  disabled?: boolean;
}

const CONSENT_LABELS: Record<ConsentArtifact['consentType'], string> = {
  data_processing: 'Data Processing',
  dashcam_access: 'Dashcam Footage Access',
  telematics_access: 'Telematics Data Access',
  evidence_submission: 'Evidence Submission',
};

const CONSENT_TEXT: Record<ConsentArtifact['consentType'], string> = {
  data_processing:
    "I consent to my personal data being processed to handle this insurance claim in accordance with GDPR and the company's Privacy Notice.",
  dashcam_access:
    'I authorise access to any dashcam footage related to this incident to support the claims investigation.',
  telematics_access:
    'I authorise retrieval of vehicle telematics data from the incident period to support the claims investigation.',
  evidence_submission:
    'I confirm that the evidence I am submitting is genuine and accurately represents the incident described.',
};

export const FNOLConsentCard = ({ consentType, onConsent, disabled }: ConsentCardProps) => {
  const [given, setGiven] = useState(false);

  const handleConsent = () => {
    setGiven(true);
    onConsent(consentType);
  };

  return (
    <div className="fnol-gate-card fnol-gate-card--consent" role="region" aria-label={`Consent: ${CONSENT_LABELS[consentType]}`}>
      <div className="fnol-gate-card__header">
        <DocumentView size={20} />
        <span>{CONSENT_LABELS[consentType]} Consent</span>
      </div>
      <p className="fnol-gate-card__text">{CONSENT_TEXT[consentType]}</p>
      {given ? (
        <InlineNotification kind="success" title="Consent recorded" subtitle={new Date().toLocaleString()} lowContrast hideCloseButton />
      ) : (
        <Button
          kind="primary"
          size="sm"
          renderIcon={Checkmark}
          onClick={handleConsent}
          disabled={disabled}
        >
          I consent
        </Button>
      )}
    </div>
  );
};

// ── Evidence upload card ──────────────────────────────────────────────────────

interface EvidenceCardProps {
  onUpload: (item: Omit<EvidenceItem, 'id' | 'uploadedAt'>) => Promise<void> | void;
  onUploadFiles?: (files: File[], category: string) => Promise<void>;
  disabled?: boolean;
}

type UploadCategory =
  | 'own_vehicle'
  | 'third_party'
  | 'scene'
  | 'medical_record'
  | 'witness_statement'
  | 'police_report';

const CATEGORY_LABELS: Record<UploadCategory, string> = {
  own_vehicle: 'Your vehicle damage',
  third_party: 'Third-party damage',
  scene: 'Accident scene',
  medical_record: 'ER / medical documents',
  witness_statement: 'Witness statements',
  police_report: 'Police report',
};

const PHOTO_CATEGORIES: UploadCategory[] = ['own_vehicle', 'third_party', 'scene'];
const DOCUMENT_CATEGORIES: UploadCategory[] = ['medical_record', 'witness_statement', 'police_report'];

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function acceptForCategory(category: UploadCategory): string {
  return PHOTO_CATEGORIES.includes(category)
    ? 'image/*'
    : 'application/pdf,.pdf,.doc,.docx,.txt,.rtf,.md,.markdown,text/markdown,image/*';
}

function getUploadErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const maybeResponse = (err as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
    const responseError = maybeResponse?.data?.error;
    if (typeof responseError === 'string' && responseError.trim()) return responseError;
    const responseMessage = maybeResponse?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Evidence upload failed.';
}

export const FNOLEvidenceCard = ({ onUpload, onUploadFiles, disabled }: EvidenceCardProps) => {
  const [policeRef, setPoliceRef] = useState('');
  const [completed, setCompleted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedCategories, setUploadedCategories] = useState<Set<UploadCategory>>(new Set());
  const [currentCategory, setCurrentCategory] = useState<UploadCategory>('own_vehicle');
  const [selectedFilesByCategory, setSelectedFilesByCategory] = useState<Partial<Record<UploadCategory, File[]>>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFiles = selectedFilesByCategory[currentCategory] ?? [];
  const categories: UploadCategory[] = [...PHOTO_CATEGORIES, ...DOCUMENT_CATEGORIES];
  const totalSelectedFiles = categories.reduce((sum, category) => sum + (selectedFilesByCategory[category]?.length ?? 0), 0);
  const queuedCategories = categories.filter((category) => (selectedFilesByCategory[category]?.length ?? 0) > 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setUploadError(null);
    setSelectedFilesByCategory((prev) => ({
      ...prev,
      [currentCategory]: [...(prev[currentCategory] ?? []), ...files],
    }));
    e.target.value = '';
  };

  const handleSubmitEvidence = async () => {
    if (totalSelectedFiles === 0 && !policeRef.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const category of categories) {
        const files = selectedFilesByCategory[category] ?? [];
        if (!files.length) continue;
        if (onUploadFiles) {
          await onUploadFiles(files, category);
        } else {
          for (const file of files) {
            await onUpload({
              type: isImageFile(file) ? 'photo' : 'document',
              filename: file.name,
              mimeType: file.type,
              category,
            });
          }
        }
        setUploadedCategories((prev) => new Set([...prev, category]));
      }
      if (policeRef.trim()) {
        await onUpload({ type: 'police_reference', policeRef: policeRef.trim() });
      }
      setSelectedFilesByCategory({});
      setCompleted(true);
    } catch (err) {
      setUploadError(getUploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => {
    const hasSelectedFiles = Object.values(selectedFilesByCategory).some((files) => (files?.length ?? 0) > 0);
    if (!uploadedCategories.size && !policeRef.trim() && !hasSelectedFiles) {
      onUpload({ type: 'photo', filename: undefined });
    }
    setCompleted(true);
  };

  return (
    <div className="fnol-gate-card fnol-gate-card--evidence" role="region" aria-label="Evidence upload">
      <div className="fnol-gate-card__header">
        <Upload size={20} />
        <span>Evidence (optional)</span>
      </div>

      {completed ? (
        <InlineNotification
          kind="success"
          title={uploadedCategories.size > 0 || policeRef.trim() ? 'Evidence submitted' : 'Evidence recorded'}
          lowContrast
          hideCloseButton
        />
      ) : (
        <>
          {/* Category selector */}
          <div className="fnol-gate-card__category-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`fnol-gate-card__category-tab ${currentCategory === cat ? 'fnol-gate-card__category-tab--active' : ''} ${uploadedCategories.has(cat) ? 'fnol-gate-card__category-tab--done' : ''}`}
                onClick={() => {
                  setCurrentCategory(cat);
                  setUploadError(null);
                }}
                disabled={disabled || uploading}
              >
                {uploadedCategories.has(cat) && <Checkmark size={12} />}
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="fnol-gate-card__fields">
            <p className="fnol-gate-card__text fnol-gate-card__text--small">
              {PHOTO_CATEGORIES.includes(currentCategory)
                ? 'Upload photos for this category.'
                : 'Upload PDFs, Word docs, text files, or scanned images for this document category.'}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={acceptForCategory(currentCategory)}
              multiple
              onChange={handleFileChange}
              className="fnol-gate-card__file-input"
              aria-label="Upload evidence files"
            />
            <Button kind="tertiary" size="sm" renderIcon={Upload} onClick={() => fileRef.current?.click()} disabled={disabled || uploading}>
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) selected`
                : PHOTO_CATEGORIES.includes(currentCategory)
                  ? `Add ${CATEGORY_LABELS[currentCategory]} photos`
                  : `Add ${CATEGORY_LABELS[currentCategory]}`}
            </Button>

            {/* File previews */}
            {selectedFiles.length > 0 && (
              <div className="fnol-gate-card__thumbnails">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="fnol-gate-card__thumb">
                    {isImageFile(f) ? (
                      <img src={URL.createObjectURL(f)} alt={f.name} />
                    ) : (
                      <div className="fnol-gate-card__file-chip">
                        <DocumentView size={16} />
                        <span>{f.name}</span>
                      </div>
                    )}
                    <button
                      className="fnol-gate-card__thumb-remove"
                      onClick={() =>
                        setSelectedFilesByCategory((prev) => ({
                          ...prev,
                          [currentCategory]: (prev[currentCategory] ?? []).filter((_, idx) => idx !== i),
                        }))
                      }
                      aria-label={`Remove ${f.name}`}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {queuedCategories.length > 0 && (
              <p className="fnol-gate-card__text fnol-gate-card__text--small">
                Queued for submit: {queuedCategories.map((category) => `${CATEGORY_LABELS[category]} (${selectedFilesByCategory[category]?.length ?? 0})`).join(' · ')}
              </p>
            )}

            {uploadError && (
              <InlineNotification
                kind="error"
                title={uploadError}
                lowContrast
                onCloseButtonClick={() => setUploadError(null)}
              />
            )}

            <Button
              kind="primary"
              size="sm"
              onClick={handleSubmitEvidence}
              disabled={disabled || uploading || (totalSelectedFiles === 0 && !policeRef.trim())}
            >
              {uploading ? 'Submitting evidence…' : `Submit all evidence${totalSelectedFiles > 0 ? ` (${totalSelectedFiles} file${totalSelectedFiles === 1 ? '' : 's'})` : ''}`}
            </Button>

            <TextInput
              id="police-ref"
              labelText="Police / crime reference number"
              placeholder="e.g. 12/345/67/AB"
              value={policeRef}
              onChange={(e) => {
                setPoliceRef(e.target.value);
                setUploadError(null);
              }}
              size="sm"
            />
          </div>
          <div className="fnol-gate-card__actions">
            <Button kind="ghost" size="sm" onClick={handleDone} disabled={disabled || uploading || totalSelectedFiles > 0 || !!policeRef.trim()}>
              Skip for now
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Callback card ─────────────────────────────────────────────────────────────

interface CallbackCardProps {
  onScheduled: () => void;
  disabled?: boolean;
}

export const FNOLCallbackCard = ({ onScheduled, disabled }: CallbackCardProps) => {
  const [scheduled, setScheduled] = useState(false);

  const handleSchedule = () => {
    setScheduled(true);
    onScheduled();
  };

  return (
    <div className="fnol-gate-card fnol-gate-card--callback" role="region" aria-label="Schedule callback">
      <div className="fnol-gate-card__header">
        <Calendar size={20} />
        <span>Schedule Callback</span>
      </div>
      <p className="fnol-gate-card__text">
        An agent will call you to complete phase two of your claim — dashcam authorisation, evidence review, and next steps.
      </p>
      {scheduled ? (
        <InlineNotification kind="success" title="Callback scheduled" lowContrast hideCloseButton />
      ) : (
        <Button kind="primary" size="sm" renderIcon={Calendar} onClick={handleSchedule} disabled={disabled}>
          Schedule callback
        </Button>
      )}
    </div>
  );
};

// ── Device access card (dashcam + telematics) ─────────────────────────────────

export interface DeviceInfo {
  dashcam?: { manufacturer: string; model: string; app?: string };
  telematics?: { provider: string; app?: string };
  vehicleDescription?: string;
}

interface DeviceAccessCardProps {
  devices: DeviceInfo;
  onGrant: (granted: { dashcam: boolean; telematics: boolean }) => void;
  disabled?: boolean;
}

export const FNOLDeviceAccessCard = ({ devices, onGrant, disabled }: DeviceAccessCardProps) => {
  const [granted, setGranted] = useState<'granted' | 'declined' | null>(null);
  const hasDashcam = !!devices.dashcam;
  const hasTelematics = !!devices.telematics;

  const deviceList = [
    hasDashcam && `${devices.dashcam!.manufacturer} ${devices.dashcam!.model} dashcam`,
    hasTelematics && `${devices.telematics!.provider} telematics`,
  ].filter(Boolean).join(' and ');

  const appList = [
    hasDashcam && devices.dashcam!.app,
    hasTelematics && devices.telematics!.app,
  ].filter(Boolean);
  const appText = appList.length ? `via ${appList.join(' / ')}` : 'via your connected app';

  const handleGrant = () => {
    setGranted('granted');
    onGrant({ dashcam: hasDashcam, telematics: hasTelematics });
  };

  const handleDecline = () => {
    setGranted('declined');
    onGrant({ dashcam: false, telematics: false });
  };

  return (
    <div className="fnol-gate-card fnol-gate-card--device-access" role="dialog" aria-label="Connected device access request">
      <div className="fnol-gate-card__device-icons">
        {hasDashcam && <div className="fnol-gate-card__device-icon"><Camera size={20} /></div>}
        {hasTelematics && <div className="fnol-gate-card__device-icon"><ChartLineData size={20} /></div>}
      </div>
      <div className="fnol-gate-card__device-heading">Share connected device data?</div>
      <p className="fnol-gate-card__text">
        We can see on file that {devices.vehicleDescription ? `your ${devices.vehicleDescription}` : 'your vehicle'} is fitted with a{' '}
        <strong>{deviceList}</strong>. Sharing this data {appText} can significantly speed up your claim and help us understand exactly what happened.
      </p>
      <p className="fnol-gate-card__text fnol-gate-card__text--small">
        You can withdraw this permission at any time via your account settings.
      </p>

      {granted === 'granted' && (
        <InlineNotification kind="success" title="Access granted" subtitle="Data will be retrieved securely." lowContrast hideCloseButton />
      )}
      {granted === 'declined' && (
        <InlineNotification kind="info" title="Access declined" subtitle="No problem — we'll proceed without it." lowContrast hideCloseButton />
      )}
      {!granted && (
        <div className="fnol-gate-card__actions fnol-gate-card__actions--stacked">
          <Button kind="primary" size="sm" renderIcon={Checkmark} onClick={handleGrant} disabled={disabled}>
            Grant access
          </Button>
          <Button kind="ghost" size="sm" onClick={handleDecline} disabled={disabled}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  summary: string;
  onConfirm: () => void;
  onEdit: () => void;
  disabled?: boolean;
}

export const FNOLSummaryCard = ({ summary, onConfirm, onEdit, disabled }: SummaryCardProps) => (
  <div className="fnol-gate-card fnol-gate-card--summary" role="region" aria-label="Claim summary">
    <div className="fnol-gate-card__header">
      <DocumentView size={20} />
      <span>Claim Summary</span>
    </div>
    <p className="fnol-gate-card__text">{summary}</p>
    <div className="fnol-gate-card__actions">
      <Button kind="primary" size="sm" onClick={onConfirm} disabled={disabled}>
        Confirm and submit
      </Button>
      <Button kind="ghost" size="sm" onClick={onEdit} disabled={disabled}>
        Make a correction
      </Button>
    </div>
  </div>
);
