import { useState } from 'react';
import {
  Accordion,
  AccordionItem,
  TextInput,
  TextArea,
  Dropdown,
  NumberInput,
  Tag,
  Button,
  FormGroup,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import type { GovernanceProfile } from '../types';
import './GovernanceProfileSection.scss';

interface GovernanceProfileSectionProps {
  profile?: GovernanceProfile;
  onChange?: (profile: GovernanceProfile) => void;
  readOnly?: boolean;
}

export const GovernanceProfileSection = ({
  profile,
  onChange,
  readOnly = false,
}: GovernanceProfileSectionProps) => {
  const [localProfile, setLocalProfile] = useState<GovernanceProfile>(
    profile || {
      authorityLevel: 'advisory',
      boundaries: [],
      humanInTheLoop: [],
    }
  );

  const handleChange = (updates: Partial<GovernanceProfile>) => {
    const updated = { ...localProfile, ...updates };
    setLocalProfile(updated);
    onChange?.(updated);
  };

  const addBoundary = () => {
    const boundaries = [...(localProfile.boundaries || []), ''];
    handleChange({ boundaries });
  };

  const removeBoundary = (index: number) => {
    const boundaries = [...(localProfile.boundaries || [])];
    boundaries.splice(index, 1);
    handleChange({ boundaries });
  };

  const updateBoundary = (index: number, value: string) => {
    const boundaries = [...(localProfile.boundaries || [])];
    boundaries[index] = value;
    handleChange({ boundaries });
  };

  const addHumanInTheLoop = () => {
    const humanInTheLoop = [...(localProfile.humanInTheLoop || []), ''];
    handleChange({ humanInTheLoop });
  };

  const removeHumanInTheLoop = (index: number) => {
    const humanInTheLoop = [...(localProfile.humanInTheLoop || [])];
    humanInTheLoop.splice(index, 1);
    handleChange({ humanInTheLoop });
  };

  const updateHumanInTheLoop = (index: number, value: string) => {
    const humanInTheLoop = [...(localProfile.humanInTheLoop || [])];
    humanInTheLoop[index] = value;
    handleChange({ humanInTheLoop });
  };

  const authorityLevels = [
    { id: 'signal', text: 'Signal - Provides information only' },
    { id: 'advisory', text: 'Advisory - Recommends actions' },
    { id: 'authoritative', text: 'Authoritative - Makes decisions' },
    { id: 'bounded-authority', text: 'Bounded Authority - Limited decision power' },
  ];

  if (readOnly) {
    return (
      <div className="governance-profile-section read-only">
        <Accordion>
          <AccordionItem title="Governance Profile">
            <div className="profile-content">
              <div className="profile-row">
                <strong>Authority Level:</strong>
                <Tag type="purple" size="sm">
                  {localProfile.authorityLevel}
                </Tag>
              </div>

              {localProfile.escalationPath && (
                <div className="profile-row">
                  <strong>Escalation Path:</strong>
                  <p>{localProfile.escalationPath}</p>
                </div>
              )}

              {localProfile.autonomyDescription && (
                <div className="profile-row">
                  <strong>Autonomy:</strong>
                  <p>{localProfile.autonomyDescription}</p>
                </div>
              )}

              {localProfile.boundaries && localProfile.boundaries.length > 0 && (
                <div className="profile-row">
                  <strong>Boundaries:</strong>
                  <ul>
                    {localProfile.boundaries.map((boundary, idx) => (
                      <li key={idx}>{boundary}</li>
                    ))}
                  </ul>
                </div>
              )}

              {localProfile.humanInTheLoop && localProfile.humanInTheLoop.length > 0 && (
                <div className="profile-row">
                  <strong>Human-in-the-Loop Requirements:</strong>
                  <ul>
                    {localProfile.humanInTheLoop.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {localProfile.confidenceThresholds && (
                <div className="profile-row">
                  <strong>Confidence Thresholds:</strong>
                  <div className="thresholds">
                    {localProfile.confidenceThresholds.minimum !== undefined && (
                      <Tag type="gray" size="sm">
                        Minimum: {(localProfile.confidenceThresholds.minimum * 100).toFixed(0)}%
                      </Tag>
                    )}
                    {localProfile.confidenceThresholds.reviewRequired !== undefined && (
                      <Tag type="cyan" size="sm">
                        Review Required: {(localProfile.confidenceThresholds.reviewRequired * 100).toFixed(0)}%
                      </Tag>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="governance-profile-section">
      <Accordion>
        <AccordionItem title="Governance Profile" open>
          <div className="profile-form">
            <Dropdown
              id="authority-level"
              titleText="Authority Level"
              label="Select authority level"
              items={authorityLevels}
              itemToString={(item) => item?.text || ''}
              selectedItem={authorityLevels.find((a) => a.id === localProfile.authorityLevel)}
              onChange={({ selectedItem }) =>
                handleChange({ authorityLevel: selectedItem?.id as GovernanceProfile['authorityLevel'] })
              }
            />

            <TextInput
              id="escalation-path"
              labelText="Escalation Path"
              placeholder="e.g., Senior Claims Manager → Director"
              value={localProfile.escalationPath || ''}
              onChange={(e) => handleChange({ escalationPath: e.target.value })}
            />

            <TextArea
              id="autonomy-description"
              labelText="Autonomy Description"
              placeholder="Describe the agent's decision-making autonomy"
              value={localProfile.autonomyDescription || ''}
              onChange={(e) => handleChange({ autonomyDescription: e.target.value })}
              rows={3}
            />

            <FormGroup legendText="Boundaries">
              {(localProfile.boundaries || []).map((boundary, index) => (
                <div key={index} className="list-item">
                  <TextInput
                    id={`boundary-${index}`}
                    labelText=""
                    placeholder="e.g., Cannot authorize payments above $10,000"
                    value={boundary}
                    onChange={(e) => updateBoundary(index, e.target.value)}
                  />
                  <Button
                    kind="danger--ghost"
                    size="sm"
                    renderIcon={TrashCan}
                    iconDescription="Remove"
                    hasIconOnly
                    onClick={() => removeBoundary(index)}
                  />
                </div>
              ))}
              <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addBoundary}>
                Add Boundary
              </Button>
            </FormGroup>

            <FormGroup legendText="Human-in-the-Loop Requirements">
              {(localProfile.humanInTheLoop || []).map((req, index) => (
                <div key={index} className="list-item">
                  <TextInput
                    id={`hitl-${index}`}
                    labelText=""
                    placeholder="e.g., Requires approval for claims over $25,000"
                    value={req}
                    onChange={(e) => updateHumanInTheLoop(index, e.target.value)}
                  />
                  <Button
                    kind="danger--ghost"
                    size="sm"
                    renderIcon={TrashCan}
                    iconDescription="Remove"
                    hasIconOnly
                    onClick={() => removeHumanInTheLoop(index)}
                  />
                </div>
              ))}
              <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addHumanInTheLoop}>
                Add Requirement
              </Button>
            </FormGroup>

            <FormGroup legendText="Confidence Thresholds">
              <NumberInput
                id="minimum-confidence"
                label="Minimum Confidence (0-1)"
                min={0}
                max={1}
                step={0.05}
                value={localProfile.confidenceThresholds?.minimum || 0.7}
                onChange={(_e, { value }) =>
                  handleChange({
                    confidenceThresholds: {
                      ...localProfile.confidenceThresholds,
                      minimum: value as number,
                    },
                  })
                }
                helperText="Minimum confidence required for agent to proceed"
              />
              <NumberInput
                id="review-confidence"
                label="Review Required Threshold (0-1)"
                min={0}
                max={1}
                step={0.05}
                value={localProfile.confidenceThresholds?.reviewRequired || 0.85}
                onChange={(_e, { value }) =>
                  handleChange({
                    confidenceThresholds: {
                      ...localProfile.confidenceThresholds,
                      reviewRequired: value as number,
                    },
                  })
                }
                helperText="Confidence below this triggers human review"
              />
            </FormGroup>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

// Made with Bob