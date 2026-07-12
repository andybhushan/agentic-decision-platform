import { Tag } from '@carbon/react';
import { StarFilled } from '@carbon/icons-react';
import type { AppointedRepresentative } from '../types';
import { tierDisplay } from '../utils/policyTier';
import './TierBadge.scss';

interface TierBadgeProps {
  tier?: string | null;
  size?: 'sm' | 'md';
}

/** Prominent, branded policy-tier badge. Signature gets a star so it stands out. */
export const TierBadge = ({ tier, size = 'sm' }: TierBadgeProps) => {
  const display = tierDisplay(tier);
  if (!display) return null;
  const isSignature = display.rank === 4;
  return (
    <Tag
      type={display.tagType}
      size={size}
      className={`tier-badge${display.topTier ? ' tier-badge--top' : ''}`}
    >
      {isSignature ? <StarFilled size={12} className="tier-badge__star" /> : null}
      {display.label}
    </Tag>
  );
};

interface RepresentativeNoteProps {
  representative?: AppointedRepresentative | null;
}

/** One-line "Appointed Representative" attribution for top-tier clients. */
export const RepresentativeNote = ({ representative }: RepresentativeNoteProps) => {
  if (!representative) return null;
  const contact = representative.contactName ? ` · ${representative.contactName}` : '';
  return (
    <span className="appointed-rep">
      <span className="appointed-rep__label">{representative.relationship ?? 'Appointed Representative'}:</span>{' '}
      {representative.firmName}{contact}
    </span>
  );
};
