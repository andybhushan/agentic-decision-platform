import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Checkbox,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineLoading,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  Tag,
  TextArea,
  TextInput,
  Tile,
} from "@carbon/react";
import { Camera, CheckmarkFilled, CloseFilled } from "@carbon/icons-react";
import { useMember } from "./MemberContext";
import { buildClaimRecord, INCIDENT_TYPES, type IncidentForm } from "./memberData";
import { submitIntake, type IntakeResult } from "../services/intakeClient";
import { prepareImage, uploadEvidence, type EvidenceUpload } from "../services/evidenceClient";

const MAX_PHOTOS = 6;

interface PendingPhoto extends EvidenceUpload {
  previewUrl: string;
  fileName: string;
}

// Report an accident or loss: the FNOL front door. Prefilled from the signed-in member's
// policy, vehicle, and contact records; only the incident itself is asked for. Submitting
// creates a real runnable subject on the platform (POST /api/intake).

const STEPS = ["Incident", "Details", "Review"] as const;

export default function ReportClaimPage() {
  const { member, refresh } = useMember();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Submitting");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<IncidentForm>(() => ({
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentType: "",
    locationCity: member?.city ?? "",
    locationState: member?.state ?? "",
    intersection: "",
    narrative: "",
    injuries: false,
    thirdPartyInvolved: false,
    policeReportFiled: false,
    photos: 0,
    vehicleId: member?.vehicles[0]?.vehicleId ?? "",
  }));

  const set = <K extends keyof IncidentForm>(key: K, value: IncidentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const vehicle = useMemo(
    () => member?.vehicles.find((v) => v.vehicleId === form.vehicleId) ?? member?.vehicles[0],
    [member, form.vehicleId],
  );

  const stepValid =
    step === 0
      ? form.incidentDate && form.incidentType && form.locationCity
      : step === 1
        ? form.narrative.trim().length >= 20
        : true;

  const channel = window.matchMedia("(max-width: 671px)").matches ? "mobile-web" : "web";

  const handleAddPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
      const prepared = await Promise.all(
        picked.map(async (f) => ({ ...(await prepareImage(f)), fileName: f.name })),
      );
      setPhotos((p) => [...p, ...prepared]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      let evidenceGroupId: string | undefined;
      if (photos.length > 0) {
        setBusyLabel("Uploading photos");
        const group = await uploadEvidence(photos.map(({ contentType, dataBase64 }) => ({ contentType, dataBase64 })));
        evidenceGroupId = group.groupId;
        setBusyLabel("Analyzing your photos");
      } else {
        setBusyLabel("Submitting");
      }
      const record = buildClaimRecord(member, { ...form, photos: photos.length }, channel, evidenceGroupId);
      const res = await submitIntake("insurance", channel, record);
      setResult(res);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!member) return null;

  if (result) {
    return (
      <div className="adp-report">
        <Tile className="adp-report__success">
          <CheckmarkFilled size={40} className="adp-report__success-icon" />
          <h2>Claim received</h2>
          <p className="adp-report__claimno">{result.subjectId}</p>
          <p className="adp-queue__dim">
            Thank you, {member.firstName}. Your claim is in the system and will be picked up for intake, coverage
            verification, triage, and routing. If anything needs a specialist's judgment, a person reviews it before
            any decision stands. You can track every step.
          </p>
          <div className="adp-member-hero__actions">
            <Button onClick={() => navigate(`/member/claims/${encodeURIComponent(result.subjectId)}`)}>
              Track this claim
            </Button>
            <Button kind="tertiary" onClick={() => navigate("/member/home")}>
              Back to my account
            </Button>
          </div>
        </Tile>
      </div>
    );
  }

  return (
    <div className="adp-report">
      <nav className="adp-member-breadcrumb">
        <Link to="/member/home">My account</Link> <span>/</span> Report a claim
      </nav>
      <h2 className="adp-report__title">Report an accident or loss</h2>
      <p className="adp-queue__dim">
        We already have your policy and vehicle on file. Tell us what happened; this takes about two minutes.
      </p>

      <div className="adp-report__prefill">
        <Tag type="teal" size="sm">{member.fullName}</Tag>
        <Tag type="teal" size="sm">{member.policy.policyNumber}</Tag>
        {vehicle && (
          <Tag type="teal" size="sm">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Tag>
        )}
      </div>

      <ProgressIndicator currentIndex={step} spaceEqually className="adp-report__steps">
        {STEPS.map((s, i) => (
          <ProgressStep key={s} label={s} complete={i < step} />
        ))}
      </ProgressIndicator>

      <Tile className="adp-report__panel">
        {step === 0 && (
          <div className="adp-report__form">
            {member.vehicles.length > 1 && (
              <Dropdown
                id="veh"
                titleText="Which vehicle was involved?"
                label="Select vehicle"
                items={member.vehicles.map((v) => v.vehicleId ?? "")}
                itemToString={(id) => {
                  const v = member.vehicles.find((x) => x.vehicleId === id);
                  return v ? `${v.year} ${v.make} ${v.model} (${v.plate})` : (id ?? "");
                }}
                selectedItem={form.vehicleId}
                onChange={({ selectedItem }) => set("vehicleId", selectedItem ?? "")}
              />
            )}
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={form.incidentDate}
              onChange={(dates: Date[]) => {
                if (dates[0]) set("incidentDate", dates[0].toISOString().slice(0, 10));
              }}
            >
              <DatePickerInput id="incident-date" labelText="When did it happen?" placeholder="yyyy-mm-dd" />
            </DatePicker>
            <Dropdown
              id="incident-type"
              titleText="What kind of incident?"
              label="Select incident type"
              items={[...INCIDENT_TYPES]}
              itemToString={(i) => (i ?? "").replaceAll("-", " ")}
              selectedItem={form.incidentType || null}
              onChange={({ selectedItem }) => set("incidentType", selectedItem ?? "")}
            />
            <div className="adp-report__row">
              <TextInput
                id="loc-city"
                labelText="City"
                value={form.locationCity}
                onChange={(e) => set("locationCity", e.target.value)}
              />
              <TextInput
                id="loc-state"
                labelText="State"
                value={form.locationState}
                onChange={(e) => set("locationState", e.target.value)}
              />
            </div>
            <TextInput
              id="loc-intersection"
              labelText="Street or intersection (optional)"
              value={form.intersection}
              onChange={(e) => set("intersection", e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="adp-report__form">
            <TextArea
              id="narrative"
              labelText="Describe what happened"
              helperText="In your own words; at least a sentence or two. This goes directly to the intake team."
              rows={5}
              value={form.narrative}
              onChange={(e) => set("narrative", e.target.value)}
            />
            <Checkbox
              id="injuries"
              labelText="Someone was injured"
              checked={form.injuries}
              onChange={(_, { checked }) => set("injuries", checked)}
            />
            <Checkbox
              id="third-party"
              labelText="Another vehicle or party was involved"
              checked={form.thirdPartyInvolved}
              onChange={(_, { checked }) => set("thirdPartyInvolved", checked)}
            />
            <Checkbox
              id="police"
              labelText="A police report was filed"
              checked={form.policeReportFiled}
              onChange={(_, { checked }) => set("policeReportFiled", checked)}
            />
            <div className="adp-report__photos">
              <p className="cds--label">Photos of the damage (optional, up to {MAX_PHOTOS})</p>
              <p className="cds--form__helper-text">
                Clear photos of each damaged area help us assess your claim faster. Our AI reviews them the moment
                you submit.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleAddPhotos(e.target.files)}
              />
              <div className="adp-report__photo-grid">
                {photos.map((p, i) => (
                  <div key={`${p.fileName}-${i}`} className="adp-report__photo-thumb">
                    <img src={p.previewUrl} alt={`Damage photo ${i + 1}`} />
                    <button
                      type="button"
                      className="adp-report__photo-remove"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <CloseFilled size={20} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    className="adp-report__photo-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoBusy}
                  >
                    {photoBusy ? <InlineLoading description="Preparing" /> : (
                      <>
                        <Camera size={24} />
                        <span>Add photos</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="adp-report__form">
            <h4>Review your report</h4>
            <dl className="adp-report__review">
              <dt>Member</dt>
              <dd>{member.fullName} · {member.policy.policyNumber}</dd>
              <dt>Vehicle</dt>
              <dd>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.plate})` : "-"}</dd>
              <dt>When</dt>
              <dd>{form.incidentDate}</dd>
              <dt>What</dt>
              <dd>{form.incidentType.replaceAll("-", " ")}</dd>
              <dt>Where</dt>
              <dd>
                {form.locationCity}, {form.locationState}
                {form.intersection ? ` · ${form.intersection}` : ""}
              </dd>
              <dt>Description</dt>
              <dd>{form.narrative}</dd>
              <dt>Flags</dt>
              <dd>
                {[
                  form.injuries ? "injuries" : null,
                  form.thirdPartyInvolved ? "third party involved" : null,
                  form.policeReportFiled ? "police report filed" : null,
                  photos.length > 0 ? `${photos.length} damage photo${photos.length > 1 ? "s" : ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "none"}
              </dd>
            </dl>
            {photos.length > 0 && (
              <div className="adp-report__photo-grid adp-report__photo-grid--review">
                {photos.map((p, i) => (
                  <div key={`${p.fileName}-${i}`} className="adp-report__photo-thumb">
                    <img src={p.previewUrl} alt={`Damage photo ${i + 1}`} />
                  </div>
                ))}
              </div>
            )}
            <p className="adp-queue__dim">
              By submitting you confirm this is accurate to the best of your knowledge. Your claim is processed on
              Meridian's decision platform: every step is recorded, grounded in your policy, and reviewable.
            </p>
          </div>
        )}

        {error && <InlineNotification kind="error" title="Could not submit" subtitle={error} lowContrast hideCloseButton />}

        <div className="adp-report__nav">
          {step > 0 ? (
            <Button kind="secondary" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              Back
            </Button>
          ) : (
            <Button kind="secondary" onClick={() => navigate("/member/home")} disabled={busy}>
              Cancel
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? <InlineLoading description={busyLabel} /> : "Submit claim"}
            </Button>
          )}
        </div>
      </Tile>
    </div>
  );
}
