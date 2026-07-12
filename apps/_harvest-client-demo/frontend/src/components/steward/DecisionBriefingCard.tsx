import { Bot } from '@carbon/icons-react';
import type { BriefingTag, DecisionBriefingData } from '../../services/stewardApi';
import './StewardBriefingCard.scss';

interface Props {
  data: DecisionBriefingData;
  adjusterName?: string;
}

const TAG_COLORS: Record<BriefingTag['color'], string> = {
  red: '#da1e28',
  orange: '#ff832b',
  yellow: '#f1c21b',
  green: '#24a148',
  blue: '#0f62fe',
};

function TagBadge({ tag }: { tag: BriefingTag }) {
  return (
    <span className="briefing-card__tag" style={{ background: TAG_COLORS[tag.color] || '#525252' }}>
      {tag.label}
    </span>
  );
}

export function DecisionBriefingCard({ data, adjusterName }: Props) {
  const greetingName = adjusterName?.trim().split(/\s+/)[0] ?? 'there';

  return (
    <div className="briefing-card">
      <p className="briefing-card__intro">
        Here's your decision briefing, {greetingName} — the facts, what's already done, and the call to make.
      </p>

      <div className="briefing-card__section-label">Decision needed</div>
      <div className="briefing-card__top-priority">
        <div className="briefing-card__top-header">
          <div>
            <div className="briefing-card__top-name">{data.name}</div>
            <div className="briefing-card__top-id">{data.claimId} · {data.incidentType}</div>
          </div>
          <div className="briefing-card__top-rank">{data.stage}</div>
        </div>

        {data.tags.length > 0 && (
          <div className="briefing-card__tags">
            {data.tags.map((t, i) => <TagBadge key={i} tag={t} />)}
          </div>
        )}

        {data.exposure > 0 && (
          <div className="briefing-card__exposure">
            <span className="briefing-card__exposure-amount">${data.exposure.toLocaleString()}</span>
            <span className="briefing-card__exposure-label">exposure</span>
          </div>
        )}

        {(data.recommendation || data.blocker || data.governanceNote) && (
          <div className="briefing-card__divider" />
        )}

        {data.recommendation && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Recommended decision</div>
            <div className="briefing-card__detail-value">{data.recommendation}</div>
          </div>
        )}

        {data.whyRecommended && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Why</div>
            <div className="briefing-card__detail-value briefing-card__detail-value--muted">{data.whyRecommended}</div>
          </div>
        )}

        {data.blocker && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Blocker</div>
            <div className="briefing-card__detail-value">{data.blocker}</div>
          </div>
        )}

        {data.governanceNote && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">{data.governanceTitle || 'Governance'}</div>
            <div className="briefing-card__detail-value briefing-card__detail-value--muted">{data.governanceNote}</div>
          </div>
        )}

        {data.completedWork.length > 0 && (
          <>
            <div className="briefing-card__divider" />
            <div className="briefing-card__detail-label">Completed work</div>
            <ul className="briefing-card__done">
              {data.completedWork.map((item, i) => (
                <li key={i} className="briefing-card__done-item">
                  <Bot className="briefing-card__done-icon" size={16} />
                  <span className="briefing-card__done-text">{item}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {data.recommendedSteps.length > 0 && (
          <>
            <div className="briefing-card__divider" />
            <div className="briefing-card__detail-label">Recommended next steps</div>
            <ol className="briefing-card__steps">
              {data.recommendedSteps.map((step, i) => (
                <li key={i} className="briefing-card__step">
                  <span className="briefing-card__step-num">{i + 1}</span>
                  <span className="briefing-card__step-text">{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
