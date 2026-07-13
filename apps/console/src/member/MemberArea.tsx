import { Content, Header, HeaderGlobalAction, HeaderGlobalBar, HeaderName, Theme } from "@carbon/react";
import { Asleep, Light, Logout } from "@carbon/icons-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { MemberProvider, useMember } from "./MemberContext";
import SignInPage from "./SignInPage";
import MemberHomePage from "./MemberHomePage";
import ReportClaimPage from "./ReportClaimPage";
import MemberClaimPage from "./MemberClaimPage";
import AssistDock from "../components/AssistDock";

// The claims use-case view: the carrier-branded (Meridian Mutual) member portal, a separate
// experience zone from the ADP platform console. Same app, own shell, claimant language.

function MemberShell() {
  const { member, signOut } = useMember();
  const { mode, carbonTheme, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <Header aria-label="Meridian Mutual Member Services" className="adp-member-header">
        <HeaderName as={Link} to="/member/home" prefix="Meridian">
          Mutual · Member Services
        </HeaderName>
        <HeaderGlobalBar>
          {member && (
            <>
              <span className="adp-member-header__who">{member.fullName}</span>
              <HeaderGlobalAction
                aria-label="Sign out"
                onClick={() => {
                  signOut();
                  navigate("/member");
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
      <Theme theme={carbonTheme} className="adp-content-theme adp-member-zone">
        <Content id="main-content">
          <div className="adp-member-page adp-route-enter" key={pathname}>
            <Routes>
              <Route path="/" element={<SignInPage />} />
              <Route path="/home" element={<RequireMember><MemberHomePage /></RequireMember>} />
              <Route path="/report" element={<RequireMember><ReportClaimPage /></RequireMember>} />
              <Route path="/claims/:subjectId" element={<RequireMember><MemberClaimPage /></RequireMember>} />
            </Routes>
          </div>
        </Content>
        {member && (
          <AssistDock
            industry="insurance"
            memberId={member.policyholderId}
            brand="Meridian Mutual"
            greeting={`Hi ${member.firstName}, I can answer questions about your policy, your claims, their status, your photos and documents, and repair estimates. What would you like to know?`}
            starters={[
              "What is the status of my latest claim?",
              "What did your AI see in my photos?",
              "What is my repair estimate?",
              "What happens next on my claim?",
            ]}
          />
        )}
      </Theme>
    </>
  );
}

function RequireMember({ children }: { children: React.ReactElement }) {
  const { member, loading } = useMember();
  if (loading) return null;
  if (!member) return <Navigate to="/member" replace />;
  return children;
}

export default function MemberArea() {
  return (
    <MemberProvider>
      <MemberShell />
    </MemberProvider>
  );
}
