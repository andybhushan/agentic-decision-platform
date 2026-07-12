import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Grid,
  Column,
  Heading,
  TextInput,
  Dropdown,
  DatePicker,
  DatePickerInput,
  Toggle,
  CheckboxGroup,
  Checkbox,
  RadioButtonGroup,
  RadioButton,
  TextArea,
  ButtonSet,
  Button,
  InlineNotification,
  Stack,
  IconButton,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { api } from '../services/api';
import type { FNOLSubmission, IncidentType } from '../types';
import './FNOLIntakePage.scss';

export const FNOLIntakePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ claimId: string } | null>(null);

  // Form state
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('Auto');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [partiesInvolved, setPartiesInvolved] = useState<Array<{ name: string; role: string }>>([
    { name: '', role: '' },
  ]);
  const [injuryIndicated, setInjuryIndicated] = useState(false);
  const [policeReportRef, setPoliceReportRef] = useState('');
  const [immediateNeeds, setImmediateNeeds] = useState<string[]>([]);
  const [preferredContactChannel, setPreferredContactChannel] = useState<'Email' | 'SMS' | 'Phone'>(
    'Email'
  );
  const [incidentDescription, setIncidentDescription] = useState('');

  const incidentTypeItems = [
    { id: 'Auto', text: 'Auto' },
    { id: 'Property', text: 'Property' },
    { id: 'Medical', text: 'Medical' },
  ];

  const addParty = () => {
    setPartiesInvolved([...partiesInvolved, { name: '', role: '' }]);
  };

  const removeParty = (index: number) => {
    if (partiesInvolved.length > 1) {
      setPartiesInvolved(partiesInvolved.filter((_, i) => i !== index));
    }
  };

  const updateParty = (index: number, field: 'name' | 'role', value: string) => {
    const updated = [...partiesInvolved];
    updated[index][field] = value;
    setPartiesInvolved(updated);
  };

  const validateForm = (): boolean => {
    if (!claimantName.trim()) {
      setError('Claimant name is required');
      return false;
    }
    if (!incidentDate) {
      setError('Incident date is required');
      return false;
    }
    if (!incidentLocation.trim()) {
      setError('Incident location is required');
      return false;
    }
    if (!incidentDescription.trim()) {
      setError('Incident description is required');
      return false;
    }
    if (partiesInvolved.length === 0 || !partiesInvolved[0].name.trim()) {
      setError('At least one party involved is required');
      return false;
    }
    if (claimantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimantEmail)) {
      setError('Invalid email format');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const submission: FNOLSubmission = {
        claimantName,
        claimantEmail: claimantEmail || undefined,
        claimantPhone: claimantPhone || undefined,
        incidentType,
        incidentDate,
        incidentTime: incidentTime || undefined,
        incidentLocation,
        partiesInvolved: partiesInvolved.filter((p) => p.name.trim()),
        injuryIndicated,
        policeReportRef: policeReportRef || undefined,
        immediateNeeds,
        preferredContactChannel,
        incidentDescription,
      };

      const claim = await api.createClaim(submission);
      setSuccess({ claimId: claim.id });

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/claims/queue');
      }, 3000);
    } catch (err) {
      console.error('Failed to submit claim:', err);
      setError('Failed to submit claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/claims/queue');
  };

  if (success) {
    return (
      <Grid className="fnol-intake-page">
        <Column lg={12} md={8} sm={4}>
          <div className="fnol-intake-page__success">
            <InlineNotification
              kind="success"
              title="Claim Submitted Successfully"
              subtitle={`Your claim has been created with ID: ${success.claimId}. You will be redirected to the decision queue shortly.`}
              lowContrast
            />
            <div className="fnol-intake-page__success-details">
              <Heading>Next Steps</Heading>
              <ul>
                <li>Your claim is now in the processing queue</li>
                <li>An adjuster will review your claim shortly</li>
                <li>You will be contacted via {preferredContactChannel.toLowerCase()}</li>
                <li>Redirecting to decision queue in 3 seconds...</li>
              </ul>
            </div>
          </div>
        </Column>
      </Grid>
    );
  }

  return (
    <Grid className="fnol-intake-page">
      <Column lg={12} md={8} sm={4}>
        <div className="fnol-intake-page__header">
          <Heading>First Notice of Loss (FNOL) Intake</Heading>
          <p className="fnol-intake-page__description">
            Please provide details about the incident. All fields marked with * are required.
          </p>
        </div>

        {error && (
          <InlineNotification
            kind="error"
            title="Validation Error"
            subtitle={error}
            onClose={() => setError('')}
            lowContrast
          />
        )}

        <Form onSubmit={handleSubmit} className="fnol-intake-page__form">
          {/* Claimant Information */}
          <div className="fnol-intake-page__section">
            <Heading className="fnol-intake-page__section-title">Claimant Information</Heading>
            <Stack gap={5}>
              <TextInput
                id="claimant-name"
                labelText="Claimant Name *"
                placeholder="Enter full name"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                required
              />
              <TextInput
                id="claimant-email"
                labelText="Email Address"
                placeholder="email@example.com"
                value={claimantEmail}
                onChange={(e) => setClaimantEmail(e.target.value)}
              />
              <TextInput
                id="claimant-phone"
                labelText="Phone Number"
                placeholder="+1-555-0123"
                value={claimantPhone}
                onChange={(e) => setClaimantPhone(e.target.value)}
              />
            </Stack>
          </div>

          {/* Incident Details */}
          <div className="fnol-intake-page__section">
            <Heading className="fnol-intake-page__section-title">Incident Details</Heading>
            <Stack gap={5}>
              <Dropdown
                id="incident-type"
                titleText="Incident Type *"
                label="Select incident type"
                items={incidentTypeItems}
                selectedItem={incidentTypeItems.find((item) => item.id === incidentType)}
                onChange={({ selectedItem }) =>
                  setIncidentType((selectedItem?.id as IncidentType) || 'Auto')
                }
              />
              <DatePicker
                datePickerType="single"
                onChange={(dates: Date[]) => {
                  if (dates[0]) {
                    setIncidentDate(dates[0].toISOString().split('T')[0]);
                  }
                }}
              >
                <DatePickerInput
                  id="incident-date"
                  placeholder="mm/dd/yyyy"
                  labelText="Incident Date *"
                  size="md"
                />
              </DatePicker>
              <TextInput
                id="incident-time"
                labelText="Incident Time"
                placeholder="HH:MM (e.g., 14:30)"
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
              />
              <TextInput
                id="incident-location"
                labelText="Incident Location *"
                placeholder="Street address, city, state"
                value={incidentLocation}
                onChange={(e) => setIncidentLocation(e.target.value)}
                required
              />
            </Stack>
          </div>

          {/* Parties Involved */}
          <div className="fnol-intake-page__section">
            <Heading className="fnol-intake-page__section-title">Parties Involved *</Heading>
            {partiesInvolved.map((party, index) => (
              <div key={index} className="fnol-intake-page__party">
                <TextInput
                  id={`party-name-${index}`}
                  labelText="Name"
                  placeholder="Full name"
                  value={party.name}
                  onChange={(e) => updateParty(index, 'name', e.target.value)}
                />
                <TextInput
                  id={`party-role-${index}`}
                  labelText="Role"
                  placeholder="e.g., Driver, Witness, Passenger"
                  value={party.role}
                  onChange={(e) => updateParty(index, 'role', e.target.value)}
                />
                {partiesInvolved.length > 1 && (
                  <IconButton
                    label="Remove party"
                    onClick={() => removeParty(index)}
                    kind="ghost"
                    size="sm"
                  >
                    <TrashCan />
                  </IconButton>
                )}
              </div>
            ))}
            <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addParty}>
              Add Another Party
            </Button>
          </div>

          {/* Additional Information */}
          <div className="fnol-intake-page__section">
            <Heading className="fnol-intake-page__section-title">Additional Information</Heading>
            <Stack gap={5}>
              <Toggle
                id="injury-indicated"
                labelText="Were there any injuries?"
                toggled={injuryIndicated}
                onToggle={(checked) => setInjuryIndicated(checked)}
              />
              <TextInput
                id="police-report"
                labelText="Police Report Reference"
                placeholder="Report number (if applicable)"
                value={policeReportRef}
                onChange={(e) => setPoliceReportRef(e.target.value)}
              />
              <CheckboxGroup legendText="Immediate Needs">
                <Checkbox
                  id="need-towing"
                  labelText="Towing"
                  checked={immediateNeeds.includes('Towing')}
                  onChange={(_, { checked }) => {
                    setImmediateNeeds(
                      checked
                        ? [...immediateNeeds, 'Towing']
                        : immediateNeeds.filter((n) => n !== 'Towing')
                    );
                  }}
                />
                <Checkbox
                  id="need-rental"
                  labelText="Rental Car"
                  checked={immediateNeeds.includes('Rental')}
                  onChange={(_, { checked }) => {
                    setImmediateNeeds(
                      checked
                        ? [...immediateNeeds, 'Rental']
                        : immediateNeeds.filter((n) => n !== 'Rental')
                    );
                  }}
                />
                <Checkbox
                  id="need-medical"
                  labelText="Medical Assistance"
                  checked={immediateNeeds.includes('Medical')}
                  onChange={(_, { checked }) => {
                    setImmediateNeeds(
                      checked
                        ? [...immediateNeeds, 'Medical']
                        : immediateNeeds.filter((n) => n !== 'Medical')
                    );
                  }}
                />
              </CheckboxGroup>
              <RadioButtonGroup
                legendText="Preferred Contact Channel"
                name="contact-channel"
                valueSelected={preferredContactChannel}
                onChange={(value) => setPreferredContactChannel(value as 'Email' | 'SMS' | 'Phone')}
              >
                <RadioButton labelText="Email" value="Email" id="contact-email" />
                <RadioButton labelText="SMS" value="SMS" id="contact-sms" />
                <RadioButton labelText="Phone" value="Phone" id="contact-phone" />
              </RadioButtonGroup>
            </Stack>
          </div>

          {/* Incident Description */}
          <div className="fnol-intake-page__section">
            <Heading className="fnol-intake-page__section-title">Incident Description *</Heading>
            <TextArea
              id="incident-description"
              labelText="Please describe what happened"
              placeholder="Provide a detailed description of the incident..."
              rows={6}
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              required
            />
          </div>

          {/* Form Actions */}
          <ButtonSet className="fnol-intake-page__actions">
            <Button kind="secondary" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </ButtonSet>
        </Form>
      </Column>
    </Grid>
  );
};

// Made with Bob