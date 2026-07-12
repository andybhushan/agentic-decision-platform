/**
 * AgentCard — single shared card component used by every agent listing view:
 * AgentCatalogPage, ChannelAgentsPage, RelatedAgentsSection.
 *
 * Uses design tokens from _design-tokens.scss via AgentCard.scss.
 */
import React from 'react';
import {
  Bot,
  FlowData,
  Document,
  Security,
  Camera,
  Renew,
  Warning,
  WorkflowAutomation,
  UserAdmin,
} from '@carbon/icons-react';
import { Checkbox } from '@carbon/react';
import './AgentCard.scss';

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  Intake:      'FIRST NOTICE OF LOSS',
  Evidence:    'DAMAGE ESTIMATE',
  Fraud:       'FRAUD & ANOMALY',
  Policy:      'COVERAGE & POLICY',
  Settlement:  'REPAIR & SETTLEMENT',
  Supervision: 'ORCHESTRATOR',
  Compliance:  'COMPLIANCE & AUDIT',
  Generic:     '',
};

function RoleIcon({ role, archetype }: { role?: string; archetype?: string }) {
  const p = { size: 16, className: 'agent-card__icon' } as const;
  switch (role) {
    case 'Supervision': return <FlowData {...p} />;
    case 'Intake':      return <Document {...p} />;
    case 'Policy':      return <Security {...p} />;
    case 'Evidence':    return <Camera {...p} />;
    case 'Settlement':  return <Renew {...p} />;
    case 'Fraud':       return <Warning {...p} />;
    case 'Compliance':  return <UserAdmin {...p} />;
  }
  // Fallback to archetype
  if (archetype === 'Orchestrator' || archetype === 'Coordinator') return <FlowData {...p} />;
  if (archetype === 'Analyst') return <WorkflowAutomation {...p} />;
  return <Bot {...p} />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AgentCardProps {
  name: string;
  description?: string;
  archetype?: string;
  workflowRole?: string;
  capabilities?: string[];
  escalationCriteria?: string[];
  /** Called when the card body is clicked */
  onClick?: () => void;
  /** Slot for action buttons rendered in the card footer */
  actions?: React.ReactNode;
  /** Highlight the card with the active/selected border */
  active?: boolean;
  className?: string;
  /** When true, renders a multi-select checkbox in the card header */
  selectable?: boolean;
  /** Whether the multi-select checkbox is checked */
  selected?: boolean;
  /** Called when the multi-select checkbox is toggled */
  onSelectChange?: (checked: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  description,
  archetype,
  workflowRole,
  capabilities = [],
  escalationCriteria = [],
  onClick,
  actions,
  active,
  className = '',
  selectable = false,
  selected = false,
  onSelectChange,
}) => {
  const roleLabel = workflowRole
    ? (ROLE_LABELS[workflowRole] ?? workflowRole.toUpperCase())
    : archetype?.toUpperCase() ?? '';

  return (
    <div
      className={`agent-card${active ? ' agent-card--active' : ''}${selected ? ' agent-card--selected' : ''}${onClick ? ' agent-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Header */}
      <div className="agent-card__header">
        {selectable && (
          <span
            className="agent-card__checkbox"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              id={`agent-card-select-${name}`}
              checked={selected}
              onChange={(_e: unknown, data: { checked: boolean }) => onSelectChange?.(data.checked)}
              labelText=""
              aria-label={`Select ${name}`}
            />
          </span>
        )}
        <RoleIcon role={workflowRole} archetype={archetype} />
        <div className="agent-card__title-group">
          <h4 className="agent-card__name">{name}</h4>
          {roleLabel && <span className="agent-card__role-label">{roleLabel}</span>}
        </div>
      </div>

      {/* Description */}
      {description && <p className="agent-card__description">{description}</p>}

      {/* Capability pills */}
      {capabilities.length > 0 && (
        <div className="agent-card__capabilities">
          {capabilities.slice(0, 3).map((cap) => (
            <span key={cap} className="agent-card__pill">{cap}</span>
          ))}
          {capabilities.length > 3 && (
            <span className="agent-card__pill agent-card__pill--more">+{capabilities.length - 3}</span>
          )}
        </div>
      )}

      {/* Escalation chip */}
      {escalationCriteria.length > 0 && (
        <div className="agent-card__escalation">
          <Warning size={12} />
          <span>{escalationCriteria[0]}</span>
        </div>
      )}

      {/* Footer actions */}
      {actions && (
        <div className="agent-card__footer" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
};
