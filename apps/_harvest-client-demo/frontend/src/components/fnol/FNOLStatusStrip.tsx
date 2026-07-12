import { Tag } from '@carbon/react';
import type { FNOLPhase } from '../../domain/fnol/types';
import { PHASE_ORDER, PHASE_LABELS } from '../../domain/fnol/types';
import './FNOLStatusStrip.scss';

interface Props {
  phase: FNOLPhase;
}

// Visible steps (exclude terminal/escalated)
const VISIBLE_PHASES: FNOLPhase[] = PHASE_ORDER.filter(
  (p) => p !== 'SUBMITTED' && p !== 'ESCALATED'
);
const TOTAL = VISIBLE_PHASES.length;

export const FNOLStatusStrip = ({ phase }: Props) => {
  const isEscalated = phase === 'ESCALATED';
  const isSubmitted = phase === 'SUBMITTED';

  const stepIdx = VISIBLE_PHASES.indexOf(phase);
  const stepNum = stepIdx >= 0 ? stepIdx + 1 : TOTAL;
  const pct = Math.round((stepNum / TOTAL) * 100);
  const label = PHASE_LABELS[phase] ?? phase;

  if (isEscalated) {
    return (
      <div className="fnol-status-strip fnol-status-strip--escalated" role="status">
        <Tag type="red" size="sm">Transferring to human agent…</Tag>
      </div>
    );
  }

  return (
    <div className="fnol-status-strip" role="status" aria-label={`Step ${stepNum} of ${TOTAL}: ${label}`}>
      <div className="fnol-status-strip__text">
        {isSubmitted
          ? <span className="fnol-status-strip__done">✓ Submitted</span>
          : <><span className="fnol-status-strip__counter">Step {stepNum} of {TOTAL}</span><span className="fnol-status-strip__sep">·</span><span className="fnol-status-strip__phase">{label}</span></>
        }
      </div>
      <div className="fnol-status-strip__bar" aria-hidden="true">
        <div className="fnol-status-strip__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
