import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Theme } from '@carbon/react';
import './styles/index.scss';
import './App.scss';

// Layout
import { AppHeader } from './components/layout/AppHeader';
import { AppContent } from './components/layout/AppContent';
import { LoginModal } from './components/LoginModal';

// Pages
import { HomePage } from './pages/HomePage';
import { DigitalWorkforcePage } from './pages/DigitalWorkforcePage';
import { AgentCatalogPage } from './pages/AgentCatalogPage';
import { AgentDetailsPage } from './pages/AgentDetailsPage';
import { WorkforceMemberDetailsPage } from './components/WorkforceMemberDetailsPage';
import ChannelAgentsPage from './components/ChannelAgentsPage';
import { AgentBuilderPage } from './pages/AgentBuilderPage';
import { WorkflowPage } from './pages/WorkflowPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { ExecutiveReportPage } from './pages/ExecutiveReportPage';
import { GovernanceDashboardPage } from './pages/GovernanceDashboardPage';

// Claims Pages
import { FNOLConversationPage } from './pages/FNOLConversationPage';
import { PolicyDashboardPage } from './pages/PolicyDashboardPage';
import { DecisionQueuePage } from './pages/DecisionQueuePage';
import { DecisionModePage } from './pages/DecisionModePage';
import { EvidencePolicyPage } from './pages/EvidencePolicyPage';
import ActionPreviewPage from './pages/ActionPreviewPage';
import { MasterClaimsPage } from './pages/MasterClaimsPage';
import { api } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const user = await api.getMe();
        if (user) {
          setIsAuthenticated(true);
          setUserName(user.userName);
          setShowLoginModal(false);
        } else {
          setShowLoginModal(true);
        }
      } catch {
        setShowLoginModal(true);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (name: string) => {
    setUserName(name);
    setIsAuthenticated(true);
    setShowLoginModal(false);
  };

  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <Theme theme="g100">
      <LoginModal open={showLoginModal && !isAuthenticated} onLoginSuccess={handleLoginSuccess} />
      <Router>
        <Routes>
          {/* PWA full-screen routes — no app shell */}
          <Route path="/claims/intake" element={<FNOLConversationPage />} />
          <Route path="/claims/dashboard" element={<PolicyDashboardPage />} />

          {/* All other routes wrapped in the app shell */}
          <Route
            path="/*"
            element={
              <div className="app">
                <AppHeader userName={userName} />
                <AppContent>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/digital-workforce" element={<DigitalWorkforcePage />} />
                    <Route path="/agents" element={<AgentCatalogPage />} />
                    <Route path="/agents/new" element={<AgentBuilderPage />} />
                    <Route path="/agents/workforce" element={<Navigate to="/agents?view=workforce" replace />} />
                    <Route path="/agents/workforce/channel/:channelId" element={<ChannelAgentsPage />} />
                    <Route path="/agents/workforce/:memberId/step/:stepId" element={<WorkforceMemberDetailsPage />} />
                    <Route path="/agents/workforce/:memberId" element={<WorkforceMemberDetailsPage />} />
                    <Route path="/agents/:id" element={<AgentDetailsPage />} />
                    <Route path="/agents/:id/edit" element={<AgentBuilderPage />} />
                    <Route path="/orchestrations" element={<WorkflowPage />} />
                    <Route path="/workflows" element={<Navigate to="/orchestrations" replace />} />
                    <Route path="/simulator" element={<SimulatorPage />} />
                    <Route path="/reports/executive" element={<ExecutiveReportPage />} />
                    <Route path="/governance" element={<GovernanceDashboardPage />} />

                    {/* Claims Routes */}
                    <Route path="/claims" element={<Navigate to="/claims/dashboard" replace />} />
                    <Route path="/claims/queue" element={<DecisionQueuePage />} />
                    <Route path="/claims/master" element={<MasterClaimsPage />} />
                    <Route path="/claims/:id/decision" element={<DecisionModePage />} />
                    <Route path="/claims/:id/evidence" element={<EvidencePolicyPage />} />
                    <Route path="/claims/:id/preview-action" element={<ActionPreviewPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppContent>
              </div>
            }
          />
        </Routes>
      </Router>
    </Theme>
  );
}

export default App;
