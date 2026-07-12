import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Column, Heading, Button } from '@carbon/react';
import { ArrowRight, Catalog, Security, Play } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import './DigitalWorkforcePage.scss';

export const DigitalWorkforcePage = () => {
  const navigate = useNavigate();
  const { verticals, setVerticals, setLoading, setError } = useStore();

  useEffect(() => {
    const loadVerticals = async () => {
      try {
        setLoading(true);
        const data = await api.getVerticals();
        setVerticals(data);
      } catch (error) {
        console.error('Failed to load verticals:', error);
        setError('Failed to load verticals');
      } finally {
        setLoading(false);
      }
    };

    loadVerticals();
  }, [setVerticals, setLoading, setError]);

  return (
    <div className="digital-workforce-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <div className="hero-section">
            <Heading className="hero-title">Digital Workforce</Heading>
            <p className="hero-subtitle">
              Design, build, and govern intelligent agent workflows.
            </p>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="feature-cards">
            <div className="feature-card">
              <Catalog size={32} />
              <h3>Agent Catalog</h3>
              <p>Browse and customize pre-built agents for various verticals</p>
              <Button
                kind="tertiary"
                renderIcon={ArrowRight}
                onClick={() => navigate('/agents')}
              >
                Explore Agents
              </Button>
            </div>

            <div className="feature-card">
              <Security size={32} />
              <h3>Governance</h3>
              <p>Monitor guardrails, risk, and human oversight across deployed agents</p>
              <Button
                kind="tertiary"
                renderIcon={ArrowRight}
                onClick={() => navigate('/governance')}
              >
                Open Governance
              </Button>
            </div>

            <div className="feature-card">
              <Play size={32} />
              <h3>Agent Simulator</h3>
              <p>Test and validate agent behavior before deployment</p>
              <Button
                kind="tertiary"
                renderIcon={ArrowRight}
                onClick={() => navigate('/simulator')}
              >
                Run Simulation
              </Button>
            </div>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="verticals-section">
            <Heading>Available Verticals</Heading>
            <div className="vertical-cards">
              {verticals.map((vertical) => (
                <div key={vertical.id} className="vertical-card" style={{ borderColor: vertical.color }}>
                  <h4>{vertical.name}</h4>
                  <p>{vertical.description}</p>
                  <div className="vertical-stats">
                    <span>{vertical.agentCount} Agents</span>
                    <span>{vertical.workflowCount} Orchestrations</span>
                  </div>
                  <Button
                    size="sm"
                    kind="ghost"
                    onClick={() => navigate(`/agents?vertical=${vertical.id}`)}
                  >
                    View Agents
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Column>
      </Grid>
    </div>
  );
};

// PROJECT IMAGINE - Digital Workforce Platform

// Made with Bob
