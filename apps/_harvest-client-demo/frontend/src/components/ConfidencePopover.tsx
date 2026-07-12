// Clickable confidence % → "why this score" popover. Answers the question
// asked twice in the Progressive transcript: "what drives the confidence
// factor — is it calculated, or pulled from different data stores?" This
// makes both explicit: a factor-by-factor breakdown, each attributed to the
// system that actually supplied the data, plus the SOP clauses that govern
// what the score is allowed to do (auto-approve threshold, authority limits).

import {
  Toggletip,
  ToggletipButton,
  ToggletipContent,
  Tag,
  Tooltip,
} from '@carbon/react';
import { Information } from '@carbon/icons-react';
import type { Claim } from '../types';
import { confidenceProvenance } from '../data/confidenceProvenance';
import './ConfidencePopover.scss';

interface ConfidencePopoverProps {
  claim: Claim;
  /** Render prop for the trigger content (e.g. "87%"). Defaults to the score + "%". */
  children?: React.ReactNode;
  align?: 'top' | 'bottom' | 'left' | 'right';
}

const toneTagType = (tone: 'positive' | 'negative' | 'neutral'): string =>
  tone === 'positive' ? 'green' : tone === 'negative' ? 'red' : 'gray';

export const ConfidencePopover = ({ claim, children, align = 'bottom' }: ConfidencePopoverProps) => {
  const provenance = confidenceProvenance(claim);

  return (
    // stopPropagation lives on this wrapping span rather than on
    // ToggletipButton itself: ToggletipButton spreads its internal
    // open/close onClick handler *before* any onClick we pass in, so an
    // onClick prop on the button would silently replace (not augment) the
    // toggle behaviour and the popover would never open.
    <span onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <Toggletip align={align} className="confidence-popover">
        <Tooltip
          align={align}
          label={`${provenance.score}% confidence — click for the full factor-by-factor breakdown and source systems.`}
        >
          <ToggletipButton
            label="Why this confidence score?"
            className="confidence-popover__trigger"
          >
            {children ?? (
              <span className="confidence-popover__trigger-inner">
                {provenance.score}%
                <Information size={14} />
              </span>
            )}
          </ToggletipButton>
        </Tooltip>
        <ToggletipContent>
          <div className="confidence-popover__body" onClick={(e) => e.stopPropagation()}>
            <p className="confidence-popover__rationale">{provenance.rationale}</p>
            <ul className="confidence-popover__factors">
              {provenance.factors.map((factor, i) => (
                <li key={i} className="confidence-popover__factor">
                  <div className="confidence-popover__factor-head">
                    <Tag type={toneTagType(factor.tone) as any} size="sm">
                      {factor.label}
                    </Tag>
                  </div>
                  <p className="confidence-popover__factor-detail">{factor.detail}</p>
                  <span className="confidence-popover__factor-source">via {factor.sourceSystem}</span>
                </li>
              ))}
            </ul>
            <div className="confidence-popover__sops">
              {provenance.sops.map((sop) => (
                <p key={sop.id} className="confidence-popover__sop">
                  <strong>{sop.id}</strong> — {sop.title}: {sop.note}
                </p>
              ))}
            </div>
          </div>
        </ToggletipContent>
      </Toggletip>
    </span>
  );
};
