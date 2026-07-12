import { Bot } from '@carbon/icons-react';
import type { BriefingData, BriefingTag } from '../../services/stewardApi';
import './StewardBriefingCard.scss';

interface Props {
  data: BriefingData;
  adjusterName?: string;
}

const TAG_COLORS: Record<BriefingTag['color'], string> = {
  red: '#da1e28',
  orange: '#ff832b',
  yellow: '#f1c21b',
  green: '#24a148',
  blue: '#0f62fe',
};

function BriefingTagBadge({ tag }: { tag: BriefingTag }) {
  return (
    <span
      className="briefing-card__tag"
      style={{ background: TAG_COLORS[tag.color] || '#525252' }}
    >
      {tag.label}
    </span>
  );
}

function urgencyColor(urgency: string): string {
  if (urgency === 'urgent') return '#da1e28';
  if (urgency === 'high') return '#ff832b';
  return '#f1c21b';
}

export function StewardBriefingCard({ data, adjusterName }: Props) {
  const { topPriority, actNow, keepAnEyeOn, queueIntelligence } = data;
  const greetingName = adjusterName?.trim().split(/\s+/)[0] ?? 'there';

  return (
    <div className="briefing-card">
      <p className="briefing-card__intro">Good morning, {greetingName}. Here's what needs your attention today.</p>

      {/* Top Priority */}
      <div className="briefing-card__section-label">Top priority</div>
      <div className="briefing-card__top-priority">
        <div className="briefing-card__top-header">
          <div>
            <div className="briefing-card__top-name">{topPriority.name}</div>
            <div className="briefing-card__top-id">{topPriority.claimId}</div>
          </div>
          <div className="briefing-card__top-rank">Rank {topPriority.rank}</div>
        </div>

        {topPriority.tags && topPriority.tags.length > 0 && (
          <div className="briefing-card__tags">
            {topPriority.tags.map((t, i) => <BriefingTagBadge key={i} tag={t} />)}
          </div>
        )}

        {topPriority.exposure > 0 && (
          <div className="briefing-card__exposure">
            <span className="briefing-card__exposure-amount">
              ${topPriority.exposure.toLocaleString()}
            </span>
            <span className="briefing-card__exposure-label">exposure</span>
          </div>
        )}

        {(topPriority.blocker || topPriority.requiredAction) && (
          <div className="briefing-card__divider" />
        )}
        {topPriority.blocker && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Blocker</div>
            <div className="briefing-card__detail-value">{topPriority.blocker}</div>
          </div>
        )}
        {topPriority.requiredAction && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Required action</div>
            <div className="briefing-card__detail-value">{topPriority.requiredAction}</div>
          </div>
        )}

        {topPriority.whyThisFirst && (
          <div className="briefing-card__detail-row">
            <div className="briefing-card__detail-label">Why this is #1</div>
            <div className="briefing-card__detail-value briefing-card__detail-value--muted">{topPriority.whyThisFirst}</div>
          </div>
        )}

        {topPriority.alreadyDone && topPriority.alreadyDone.length > 0 && (
          <>
            <div className="briefing-card__divider" />
            <div className="briefing-card__detail-label">Completed work</div>
            <ul className="briefing-card__done">
              {topPriority.alreadyDone.map((item, i) => (
                <li key={i} className="briefing-card__done-item">
                  <Bot className="briefing-card__done-icon" size={16} />
                  <span className="briefing-card__done-text">{item}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {topPriority.recommendedSteps && topPriority.recommendedSteps.length > 0 && (
          <>
            <div className="briefing-card__divider" />
            <div className="briefing-card__detail-label">Recommended next steps</div>
            <ol className="briefing-card__steps">
              {topPriority.recommendedSteps.map((step, i) => (
                <li key={i} className="briefing-card__step">
                  <span className="briefing-card__step-num">{i + 1}</span>
                  <span className="briefing-card__step-text">{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {/* Queue intelligence — portfolio-level read the per-claim cards don't show */}
      {queueIntelligence && (
        <>
          <div className="briefing-card__section-label">Queue intelligence</div>
          <div className="briefing-card__queue">
            <div className="briefing-card__queue-stats">
              <div className="briefing-card__queue-stat">
                <span className="briefing-card__queue-value">${queueIntelligence.totalExposure.toLocaleString()}</span>
                <span className="briefing-card__queue-label">Total exposure</span>
              </div>
              <div className="briefing-card__queue-stat">
                <span className="briefing-card__queue-value">{queueIntelligence.openDecisions}</span>
                <span className="briefing-card__queue-label">Open decisions</span>
              </div>
              <div className="briefing-card__queue-stat">
                <span className="briefing-card__queue-value">{queueIntelligence.highPriorityCount}</span>
                <span className="briefing-card__queue-label">High priority</span>
              </div>
              <div className="briefing-card__queue-stat">
                <span className="briefing-card__queue-value">{queueIntelligence.fraudFlags}</span>
                <span className="briefing-card__queue-label">Fraud flags</span>
              </div>
            </div>
            {queueIntelligence.oldestWaiting && (
              <div className="briefing-card__queue-row">
                <span className="briefing-card__queue-row-label">Longest waiting</span>
                <span className="briefing-card__queue-row-value">{queueIntelligence.oldestWaiting}</span>
              </div>
            )}
            {queueIntelligence.note && (
              <div className="briefing-card__queue-note">{queueIntelligence.note}</div>
            )}
          </div>
        </>
      )}

      {/* Act Now */}
      {actNow && actNow.length > 0 && (
        <>
          <div className="briefing-card__section-label">Act now</div>
          <div className="briefing-card__act-now">
            {actNow.map((item, i) => (
              <div key={i} className="briefing-card__act-item">
                <div
                  className="briefing-card__act-indicator"
                  style={{ background: urgencyColor(item.urgency) }}
                />
                <div className="briefing-card__act-content">
                  <div className="briefing-card__act-header">
                    <span className="briefing-card__act-name">{item.name}</span>
                    <span className="briefing-card__act-time">{item.timeInQueue}</span>
                  </div>
                  <div className="briefing-card__act-reason">{item.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Keep an Eye On */}
      {keepAnEyeOn && keepAnEyeOn.length > 0 && (
        <>
          <div className="briefing-card__section-label">Keep an eye on</div>
          <div className="briefing-card__watch">
            {keepAnEyeOn.map((item, i) => (
              <div key={i} className="briefing-card__watch-item">
                <span className="briefing-card__watch-id">{item.identifier}</span>
                <span className="briefing-card__watch-note">{item.note}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
