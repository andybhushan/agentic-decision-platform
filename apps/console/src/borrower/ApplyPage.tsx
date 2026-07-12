import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Dropdown,
  InlineLoading,
  InlineNotification,
  NumberInput,
  ProgressIndicator,
  ProgressStep,
  Tag,
  Tile,
} from "@carbon/react";
import { CheckmarkFilled } from "@carbon/icons-react";
import { useBorrower } from "./BorrowerContext";
import { buildApplicationRecord, LOAN_PURPOSES, type LoanForm } from "./borrowerData";
import { submitIntake, type IntakeResult } from "../services/intakeClient";

// Apply for a loan: the origination front door. The borrower's financial profile is already
// on file; only the loan ask is new. Submitting creates a real runnable subject (POST /api/intake).

const STEPS = ["Loan", "Review"] as const;

const money = (v: number) => `$${v.toLocaleString("en-US")}`;

export default function ApplyPage() {
  const { borrower, refresh } = useBorrower();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);

  const [form, setForm] = useState<LoanForm>({
    loanPurpose: "",
    loanAmount: 25000,
    termMonths: 60,
    collateralValue: 0,
  });
  const set = <K extends keyof LoanForm>(key: K, value: LoanForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const channel = window.matchMedia("(max-width: 671px)").matches ? "mobile-web" : "web";
  const stepValid = step === 0 ? form.loanPurpose && form.loanAmount >= 1000 && form.termMonths >= 6 : true;

  const handleSubmit = async () => {
    if (!borrower) return;
    setBusy(true);
    setError(null);
    try {
      const record = buildApplicationRecord(borrower, form);
      const res = await submitIntake("banking", channel, record);
      setResult(res);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!borrower) return null;

  if (result) {
    return (
      <div className="adp-report">
        <Tile className="adp-report__success">
          <CheckmarkFilled size={40} className="adp-report__success-icon" />
          <h2>Application received</h2>
          <p className="adp-report__claimno">{result.subjectId}</p>
          <p className="adp-queue__dim">
            Thank you, {borrower.name.split(" ")[0]}. Your application is in the system and will be assessed against
            Northwind's lending policy: parsing, eligibility, and decision, each step recorded. If anything needs a
            loan officer's judgment, a person reviews it first.
          </p>
          <div className="adp-member-hero__actions">
            <Button onClick={() => navigate(`/bank/applications/${encodeURIComponent(result.subjectId)}`)}>
              Track this application
            </Button>
            <Button kind="tertiary" onClick={() => navigate("/bank/home")}>
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
        <Link to="/bank/home">My account</Link> <span>/</span> Apply for a loan
      </nav>
      <h2 className="adp-report__title">Apply for a loan</h2>
      <p className="adp-queue__dim">
        Your profile and financials are already on file. Tell us about the loan; this takes about a minute.
      </p>

      <div className="adp-report__prefill">
        <Tag type="purple" size="sm">{borrower.name}</Tag>
        <Tag type="purple" size="sm">FICO {borrower.ficoScore} ({borrower.ficoBand})</Tag>
        <Tag type="purple" size="sm">{borrower.employer}</Tag>
      </div>

      <ProgressIndicator currentIndex={step} spaceEqually className="adp-report__steps">
        {STEPS.map((s, i) => (
          <ProgressStep key={s} label={s} complete={i < step} />
        ))}
      </ProgressIndicator>

      <Tile className="adp-report__panel">
        {step === 0 && (
          <div className="adp-report__form">
            <Dropdown
              id="purpose"
              titleText="What is the loan for?"
              label="Select purpose"
              items={[...LOAN_PURPOSES]}
              itemToString={(i) => (i ?? "").replaceAll("-", " ")}
              selectedItem={form.loanPurpose || null}
              onChange={({ selectedItem }) => set("loanPurpose", selectedItem ?? "")}
            />
            <NumberInput
              id="amount"
              label="Loan amount (USD)"
              min={1000}
              max={500000}
              step={1000}
              value={form.loanAmount}
              onChange={(_, { value }) => set("loanAmount", Number(value) || 0)}
            />
            <NumberInput
              id="term"
              label="Term (months)"
              min={6}
              max={360}
              step={6}
              value={form.termMonths}
              onChange={(_, { value }) => set("termMonths", Number(value) || 0)}
            />
            <NumberInput
              id="collateral"
              label="Collateral value (USD, if any)"
              helperText="For secured loans such as auto or home equity"
              min={0}
              max={2000000}
              step={500}
              value={form.collateralValue}
              onChange={(_, { value }) => set("collateralValue", Number(value) || 0)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="adp-report__form">
            <h4>Review your application</h4>
            <dl className="adp-report__review">
              <dt>Applicant</dt>
              <dd>{borrower.name} · {borrower.employer} ({borrower.employerTenureYears} yrs)</dd>
              <dt>Loan</dt>
              <dd>{money(form.loanAmount)} {form.loanPurpose.replaceAll("-", " ")} over {form.termMonths} months</dd>
              <dt>Collateral</dt>
              <dd>{form.collateralValue > 0 ? money(form.collateralValue) : "none"}</dd>
              <dt>On file</dt>
              <dd>
                FICO {borrower.ficoScore} ({borrower.ficoBand}) · income {money(borrower.grossMonthlyIncome ?? 0)}/mo ·
                debt {money(borrower.existingMonthlyDebt ?? 0)}/mo
              </dd>
            </dl>
            <p className="adp-queue__dim">
              By submitting you confirm the request is accurate. Your application is decided on Northwind's decision
              platform: every step recorded, grounded in published lending policy, and reviewable.
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
            <Button kind="secondary" onClick={() => navigate("/bank/home")} disabled={busy}>
              Cancel
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? <InlineLoading description="Submitting" /> : "Submit application"}
            </Button>
          )}
        </div>
      </Tile>
    </div>
  );
}
