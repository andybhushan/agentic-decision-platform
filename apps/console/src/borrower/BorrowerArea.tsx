import { Content, Header, HeaderGlobalAction, HeaderGlobalBar, HeaderName, Theme } from "@carbon/react";
import { Asleep, Light, Logout } from "@carbon/icons-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { BorrowerProvider, useBorrower } from "./BorrowerContext";
import BankSignInPage from "./BankSignInPage";
import BorrowerHomePage from "./BorrowerHomePage";
import ApplyPage from "./ApplyPage";
import BorrowerApplicationPage from "./BorrowerApplicationPage";

// The lending use-case view: the bank-branded (Northwind Bank) borrower portal.
// Reuses the member-portal visual system with the banking accent.

function BorrowerShell() {
  const { borrower, signOut } = useBorrower();
  const { mode, carbonTheme, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <Header aria-label="Northwind Bank Lending" className="adp-member-header adp-member-header--bank">
        <HeaderName as={Link} to="/bank/home" prefix="Northwind">
          Bank · Lending
        </HeaderName>
        <HeaderGlobalBar>
          {borrower && (
            <>
              <span className="adp-member-header__who">{borrower.name}</span>
              <HeaderGlobalAction
                aria-label="Sign out"
                onClick={() => {
                  signOut();
                  navigate("/bank");
                }}
              >
                <Logout size={20} />
              </HeaderGlobalAction>
            </>
          )}
          <HeaderGlobalAction
            aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            tooltipAlignment="end"
            onClick={toggle}
          >
            {mode === "dark" ? <Light size={20} /> : <Asleep size={20} />}
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <Theme theme={carbonTheme} className="adp-content-theme adp-member-zone adp-bank-zone">
        <Content id="main-content">
          <div className="adp-member-page adp-route-enter" key={pathname}>
            <Routes>
              <Route path="/" element={<BankSignInPage />} />
              <Route path="/home" element={<RequireBorrower><BorrowerHomePage /></RequireBorrower>} />
              <Route path="/apply" element={<RequireBorrower><ApplyPage /></RequireBorrower>} />
              <Route path="/applications/:subjectId" element={<RequireBorrower><BorrowerApplicationPage /></RequireBorrower>} />
            </Routes>
          </div>
        </Content>
      </Theme>
    </>
  );
}

function RequireBorrower({ children }: { children: React.ReactElement }) {
  const { borrower, loading } = useBorrower();
  if (loading) return null;
  if (!borrower) return <Navigate to="/bank" replace />;
  return children;
}

export default function BorrowerArea() {
  return (
    <BorrowerProvider>
      <BorrowerShell />
    </BorrowerProvider>
  );
}
