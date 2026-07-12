import { useEffect, useMemo, useState } from 'react';
import { Header, HeaderName, HeaderNavigation, HeaderMenuItem, HeaderMenu, HeaderGlobalBar, HeaderGlobalAction, Dropdown, Tag, ProgressBar } from '@carbon/react';
import { Notification, UserAvatar } from '@carbon/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAdjusterPersonaStore } from '../../store/useAdjusterPersonaStore';
import './AppHeader.scss';

const ADJUSTER_AVATAR_COLORS: Record<string, string> = {
  adj_patel:     '#8a3ffc',
  adj_whitfield: '#0f62fe',
  adj_pemberton: '#009d9a',
  adj_chen:      '#f1c21b',
  adj_blackwood: '#24a148',
  adj_ashworth:  '#6f6f6f',
};

export const AppHeader = ({ userName = 'Demo User' }: { userName?: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { adjusters, activeAdjusterId, setAdjusters, setActiveAdjuster, hydrateActiveAdjuster } = useAdjusterPersonaStore();

  useEffect(() => {
    hydrateActiveAdjuster();
    void api.getAdjusters().then(setAdjusters).catch(() => {});
  }, [hydrateActiveAdjuster, setAdjusters]);

  const adjusterItems = useMemo(
    () =>
      adjusters.map((adjuster) => ({
        id: adjuster.id,
        text: adjuster.name,
      })),
    [adjusters]
  );

  const activeAdjuster = adjusters.find((adjuster) => adjuster.id === activeAdjusterId) ?? adjusters[0] ?? null;

  const handleAdjusterSwitch = (nextAdjusterId: string | null) => {
    if (!nextAdjusterId || nextAdjusterId === activeAdjusterId) return;
    setActiveAdjuster(nextAdjusterId);
    setShowProfileMenu(false);
    window.location.reload();
  };

  return (
    <Header aria-label="PROJECT IMAGINE">
      <HeaderName href="/" prefix="">
        PROJECT IMAGINE
      </HeaderName>
      <HeaderNavigation aria-label="Main Navigation">
        <HeaderMenuItem
          href="/digital-workforce"
          isActive={location.pathname.startsWith('/digital-workforce') || location.pathname.startsWith('/agents') || location.pathname.startsWith('/orchestrations') || location.pathname.startsWith('/simulator')}
          onClick={(e) => {
            e.preventDefault();
            navigate('/digital-workforce');
          }}
        >
          Digital Workforce
        </HeaderMenuItem>
        <HeaderMenuItem
          href="/governance"
          isActive={location.pathname.startsWith('/governance')}
          onClick={(e) => {
            e.preventDefault();
            navigate('/governance');
          }}
        >
          Governance
        </HeaderMenuItem>
        <HeaderMenu
          aria-label="Auto Claims"
          menuLinkName="Auto Claims"
          isActive={location.pathname.startsWith('/claims')}
        >
          <HeaderMenuItem
            href="/claims/dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigate('/claims/dashboard');
            }}
          >
            FNOL Intake
          </HeaderMenuItem>
          <HeaderMenuItem
            href="/claims/master"
            onClick={(e) => {
              e.preventDefault();
              navigate('/claims/master');
            }}
          >
            Master Claims
          </HeaderMenuItem>
          <HeaderMenuItem
            href="/claims/queue"
            onClick={(e) => {
              e.preventDefault();
              navigate('/claims/queue');
            }}
          >
            Decision Queue
          </HeaderMenuItem>
        </HeaderMenu>
      </HeaderNavigation>
      <HeaderGlobalBar>
        <HeaderGlobalAction aria-label="Notifications" tooltipAlignment="end">
          <Notification size={20} />
        </HeaderGlobalAction>
        <div className="app-header__profile">
          <HeaderGlobalAction
            aria-label="User Profile"
            tooltipAlignment="end"
            onClick={() => setShowProfileMenu((open) => !open)}
            isActive={showProfileMenu}
          >
            <UserAvatar size={20} />
          </HeaderGlobalAction>
          {showProfileMenu && activeAdjuster && (
            <div className="app-header__profile-menu">
              {/* User section */}
              <div className="app-header__profile-section">
                <div className="app-header__profile-label">User</div>
                <div className="app-header__profile-name">{userName}</div>
              </div>

              {/* Adjuster persona section */}
              <div className="app-header__profile-section">
                <div className="app-header__profile-label">Adjuster Persona</div>
                <div className="app-header__adjuster-header">
                  <div
                    className="app-header__adjuster-avatar"
                    style={{ background: ADJUSTER_AVATAR_COLORS[activeAdjuster.id] ?? '#525252' }}
                  >
                    {activeAdjuster.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="app-header__adjuster-name-block">
                    <div className="app-header__profile-name" style={{ marginBottom: 0 }}>{activeAdjuster.name}</div>
                    <div className="app-header__profile-meta">{activeAdjuster.team}</div>
                  </div>
                  <Tag type="cool-gray" size="sm">{activeAdjuster.seniority}</Tag>
                </div>

                <p className="app-header__adjuster-bio">{activeAdjuster.bio}</p>

                <div className="app-header__adjuster-stats">
                  <div className="app-header__adjuster-stat">
                    <span className="app-header__adjuster-stat-value">{activeAdjuster.yearsExperience}</span>
                    <span className="app-header__adjuster-stat-label">yrs exp</span>
                  </div>
                  <div className="app-header__adjuster-stat">
                    <span className="app-header__adjuster-stat-value">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(activeAdjuster.authorityLimit)}
                    </span>
                    <span className="app-header__adjuster-stat-label">authority</span>
                  </div>
                  <div className="app-header__adjuster-stat">
                    <span className="app-header__adjuster-stat-value">{activeAdjuster.stats.successRate}%</span>
                    <span className="app-header__adjuster-stat-label">success</span>
                  </div>
                  <div className="app-header__adjuster-stat">
                    <span className="app-header__adjuster-stat-value">{activeAdjuster.stats.avgResolutionDays}d</span>
                    <span className="app-header__adjuster-stat-label">avg close</span>
                  </div>
                </div>

                <div className="app-header__adjuster-specs">
                  {activeAdjuster.specialisations.slice(0, 4).map(spec => (
                    <Tag key={spec} type="blue" size="sm">{spec}</Tag>
                  ))}
                </div>

                <div className="app-header__adjuster-workload">
                  <div className="app-header__adjuster-workload-label">
                    <span>Workload</span>
                    <span style={{ color: activeAdjuster.currentWorkload >= activeAdjuster.maxCapacity ? '#fa4d56' : activeAdjuster.currentWorkload / activeAdjuster.maxCapacity >= 0.8 ? '#f1c21b' : undefined }}>
                      {activeAdjuster.currentWorkload} active / {activeAdjuster.maxCapacity} capacity
                    </span>
                  </div>
                  <ProgressBar
                    value={activeAdjuster.maxCapacity > 0 ? Math.min(100, Math.round((activeAdjuster.currentWorkload / activeAdjuster.maxCapacity) * 100)) : 0}
                    label=""
                    hideLabel={true}
                    status={activeAdjuster.currentWorkload >= activeAdjuster.maxCapacity ? 'error' : activeAdjuster.currentWorkload / activeAdjuster.maxCapacity >= 0.8 ? 'active' : 'finished'}
                  />
                </div>
              </div>

              {/* Switch persona */}
              <div className="app-header__profile-section">
                <div className="app-header__profile-label" style={{ marginBottom: '0.5rem' }}>Switch Persona</div>
                <Dropdown
                  id="header-adjuster-switch"
                  titleText=""
                  label="Switch adjuster"
                  items={adjusterItems}
                  itemToString={(item) => item?.text || ''}
                  selectedItem={adjusterItems.find((item) => item.id === activeAdjuster.id) ?? null}
                  onChange={({ selectedItem }) => handleAdjusterSwitch(selectedItem?.id ?? null)}
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      </HeaderGlobalBar>
    </Header>
  );
};

// PROJECT IMAGINE - AI-Powered Digital Workforce Platform
