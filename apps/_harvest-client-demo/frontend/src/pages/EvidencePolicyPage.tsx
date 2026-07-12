import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Grid, Column, Heading, Button, Loading, InlineNotification } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { api } from '../services/api';
import type { Claim } from '../types';
import { ClaimDocket } from '../components/ClaimDocket';
import './EvidencePolicyPage.scss';

export const EvidencePolicyPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClaim = async (claimId: string) => {
    try {
      setLoading(true);
      const data = await api.getClaim(claimId);
      setClaim(data);
    } catch (err) {
      console.error('Failed to load claim:', err);
      setError('Failed to load claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loadClaim(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <Grid className="evidence-policy-page">
        <Column lg={16}>
          <Loading description="Loading evidence..." withOverlay={false} />
        </Column>
      </Grid>
    );
  }

  if (error || !claim) {
    return (
      <Grid className="evidence-policy-page">
        <Column lg={16}>
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error || 'Claim not found'}
            lowContrast
          />
          <Button onClick={() => navigate(`/claims/${id}/decision`)}>Back to Decision Mode</Button>
        </Column>
      </Grid>
    );
  }

  return (
    <Grid className="evidence-policy-page">
      <Column lg={16}>
        <div className="evidence-policy-page__header">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => navigate(`/claims/${claim.id}/decision`)}
          >
            Back to Decision Mode
          </Button>
          <Heading>Evidence &amp; Policy Context: {claim.id}</Heading>
        </div>

        <ClaimDocket claim={claim} />
      </Column>
    </Grid>
  );
};

// Made with Bob
