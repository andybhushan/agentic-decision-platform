// Derives the borrower universe from the banking records: who the borrowers are, their
// financial profile, and their applications. Use-case experience logic (Northwind Bank
// borrower portal); the platform shell never imports it.

export interface LoanApplication {
  applicationId?: string;
  borrowerId?: string;
  borrowerName?: string;
  state?: string;
  ageBand?: string;
  employer?: string;
  employerTenureYears?: number;
  applicationDate?: string;
  loanAmount?: number;
  termMonths?: number;
  loanPurpose?: string;
  collateralValue?: number;
  ficoScore?: number;
  ficoBand?: string;
  grossMonthlyIncome?: number;
  existingMonthlyDebt?: number;
  languagePreference?: string;
  [key: string]: unknown;
}

export interface BorrowerProfile {
  borrowerId: string;
  name: string;
  state?: string;
  ageBand?: string;
  employer?: string;
  employerTenureYears?: number;
  ficoScore?: number;
  ficoBand?: string;
  grossMonthlyIncome?: number;
  existingMonthlyDebt?: number;
  languagePreference?: string;
  applications: LoanApplication[];
}

export function deriveBorrowers(records: LoanApplication[]): BorrowerProfile[] {
  const byId = new Map<string, BorrowerProfile>();
  for (const r of records) {
    const id = r.borrowerId;
    if (!id) continue;
    let b = byId.get(id);
    if (!b) {
      b = {
        borrowerId: id,
        name: r.borrowerName ?? id,
        state: r.state,
        ageBand: r.ageBand,
        employer: r.employer,
        employerTenureYears: r.employerTenureYears,
        ficoScore: r.ficoScore,
        ficoBand: r.ficoBand,
        grossMonthlyIncome: r.grossMonthlyIncome,
        existingMonthlyDebt: r.existingMonthlyDebt,
        languagePreference: r.languagePreference,
        applications: [],
      };
      byId.set(id, b);
    }
    b.applications.push(r);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const LOAN_PURPOSES = ["auto", "personal", "home-equity", "consolidation", "mortgage"] as const;

export interface LoanForm {
  loanPurpose: string;
  loanAmount: number;
  termMonths: number;
  collateralValue: number;
}

// A new application reuses the borrower's known financial profile; only the loan ask is new.
// The application id is assigned server-side; eval-hint fields ("scenario") are corpus-only
// and deliberately absent.
export function buildApplicationRecord(borrower: BorrowerProfile, form: LoanForm): LoanApplication {
  return {
    borrowerId: borrower.borrowerId,
    borrowerName: borrower.name,
    state: borrower.state,
    ageBand: borrower.ageBand,
    employer: borrower.employer,
    employerTenureYears: borrower.employerTenureYears,
    applicationDate: new Date().toISOString().slice(0, 10),
    loanAmount: form.loanAmount,
    termMonths: form.termMonths,
    loanPurpose: form.loanPurpose,
    collateralValue: form.collateralValue || 0,
    ficoScore: borrower.ficoScore,
    ficoBand: borrower.ficoBand,
    grossMonthlyIncome: borrower.grossMonthlyIncome,
    existingMonthlyDebt: borrower.existingMonthlyDebt,
    languagePreference: borrower.languagePreference ?? "en",
  };
}
