import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Column,
  Tile,
  InlineNotification,
  Loading,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Dropdown,
  TextInput,
  Button,
  Tag,
} from '@carbon/react';
import PageHeader from '../components/layout/PageHeader';
import { api, type MasterClaimRecord } from '../services/api';
import { TierBadge, RepresentativeNote } from '../components/TierBadge';
import './MasterClaimsPage.scss';

const STAGE_OPTIONS = [
  { id: 'all', text: 'All stages' },
  { id: 'intake', text: 'Intake' },
  { id: 'investigation', text: 'Investigation' },
  { id: 'evaluation', text: 'Evaluation' },
  { id: 'settlement', text: 'Settlement' },
  { id: 'closed', text: 'Closed' },
];

const TIER_OPTIONS = [
  { id: 'all', text: 'All tiers' },
  { id: 'standard', text: 'Core' },
  { id: 'priority', text: 'Premier' },
  { id: 'white_glove', text: 'Masterpiece' },
  { id: 'signature', text: 'Masterpiece Signature' },
];

const SEEDED_OPTIONS = [
  { id: 'all', text: 'All data' },
  { id: 'seeded', text: 'Seeded only' },
];

const formatTs = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

export const MasterClaimsPage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<MasterClaimRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState(STAGE_OPTIONS[0]);
  const [tier, setTier] = useState(TIER_OPTIONS[0]);
  const [seeded, setSeeded] = useState(SEEDED_OPTIONS[0]);
  const [total, setTotal] = useState(0);

  const filters = useMemo(() => ({
    stage: stage.id === 'all' ? undefined : stage.id,
    clientTier: tier.id === 'all' ? undefined : tier.id,
    seededOnly: seeded.id === 'seeded' ? true : undefined,
    search: search.trim() || undefined,
    page: 1,
    pageSize: 100,
  }), [search, seeded.id, stage.id, tier.id]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.getMasterClaims(filters);
        setClaims(response.data);
        setTotal(response.meta.total);
      } catch (loadError) {
        console.error('Failed to load master claims view:', loadError);
        setError('Unable to load master claims data.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filters]);

  return (
    <div className="master-claims-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            title="Master Claims"
            subtitle="Cross-portfolio view of all claims, policy holders, tiers, and seeded governance signals."
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="master-claims-page__filters">
            <TextInput
              id="master-claims-search"
              labelText="Search"
              placeholder="Claim ID, claimant, policy holder, policy ref, adjuster"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Dropdown
              id="master-claims-stage"
              titleText="Claim stage"
              label="Select stage"
              items={STAGE_OPTIONS}
              selectedItem={stage}
              itemToString={(item) => item?.text || ''}
              onChange={({ selectedItem }) => selectedItem && setStage(selectedItem)}
            />
            <Dropdown
              id="master-claims-tier"
              titleText="Client tier"
              label="Select tier"
              items={TIER_OPTIONS}
              selectedItem={tier}
              itemToString={(item) => item?.text || ''}
              onChange={({ selectedItem }) => selectedItem && setTier(selectedItem)}
            />
            <Dropdown
              id="master-claims-seeded"
              titleText="Dataset"
              label="Select dataset"
              items={SEEDED_OPTIONS}
              selectedItem={seeded}
              itemToString={(item) => item?.text || ''}
              onChange={({ selectedItem }) => selectedItem && setSeeded(selectedItem)}
            />
          </Tile>
        </Column>

        {error ? (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification kind="error" lowContrast hideCloseButton title="Master claims unavailable" subtitle={error} />
          </Column>
        ) : null}

        <Column lg={16} md={8} sm={4}>
          <Tile className="master-claims-page__table-wrap">
            <div className="master-claims-page__summary">
              <strong>{total}</strong> claims
            </div>
            {loading ? (
              <div className="master-claims-page__loading">
                <Loading description="Loading master claims" withOverlay={false} />
              </div>
            ) : (
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableHeader>Claim</TableHeader>
                    <TableHeader>Claimant / Holder</TableHeader>
                    <TableHeader>Policy</TableHeader>
                    <TableHeader>Stage / Priority</TableHeader>
                    <TableHeader>Tier / Handling</TableHeader>
                    <TableHeader>Adjuster</TableHeader>
                    <TableHeader>Updated</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.claimId}>
                      <TableCell>
                        <div className="master-claims-page__stack">
                          <strong>{claim.claimId}</strong>
                          <span>{claim.pendingDecisionType}</span>
                          {claim.seeded ? <Tag type="teal">Seeded</Tag> : <Tag type="cool-gray">Live</Tag>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="master-claims-page__stack">
                          <span className="master-claims-page__claimant">
                            {claim.claimantName}
                            <TierBadge tier={claim.clientTier} />
                          </span>
                          <span>{claim.holderName}</span>
                          {claim.holderEmail ? <span>{claim.holderEmail}</span> : null}
                          <RepresentativeNote representative={claim.appointedRepresentative} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="master-claims-page__stack">
                          <span>{claim.policyRef}</span>
                          <span>{claim.policyType ?? 'Policy'}</span>
                          <span>{claim.coverageType ?? 'Coverage unavailable'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="master-claims-page__stack">
                          <Tag type="blue">{claim.claimStage}</Tag>
                          <Tag type={claim.priority === 'urgent' ? 'red' : claim.priority === 'high' ? 'magenta' : 'cool-gray'}>
                            {claim.priority}
                          </Tag>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="master-claims-page__stack">
                          <TierBadge tier={claim.clientTier} />
                          <span>{claim.handlingMode ?? '—'}</span>
                          {claim.governanceFlags.length ? <Tag type="warm-gray">{claim.governanceFlags.length} flag(s)</Tag> : null}
                        </div>
                      </TableCell>
                      <TableCell>{claim.assignedAdjusterName ?? claim.owner ?? 'Unassigned'}</TableCell>
                      <TableCell>{formatTs(claim.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="master-claims-page__actions">
                          <Button kind="ghost" size="sm" onClick={() => navigate(`/claims/${claim.claimId}/decision`)}>
                            Decision
                          </Button>
                          <Button kind="ghost" size="sm" onClick={() => navigate(`/claims/${claim.claimId}/evidence`)}>
                            Evidence
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Tile>
        </Column>
      </Grid>
    </div>
  );
};

