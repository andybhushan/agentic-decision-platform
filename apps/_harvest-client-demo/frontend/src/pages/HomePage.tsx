import { useNavigate } from 'react-router-dom';
import { Grid, Column, Heading, Button } from '@carbon/react';
import { ArrowRight, Collaborate, DataVis_1, Rocket, Security } from '@carbon/icons-react';
import './HomePage.scss';

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <div className="hero-section">
            <div className="hero-badge">PROJECT IMAGINE</div>
            <Heading className="hero-title">
              Building the Future of AI-Powered Work
            </Heading>
            <p className="hero-subtitle">
              A comprehensive platform for designing, deploying, and governing intelligent digital workforce solutions that transform how organizations operate.
            </p>
            <div className="hero-actions">
              <Button
                size="lg"
                renderIcon={ArrowRight}
                onClick={() => navigate('/digital-workforce')}
              >
                Explore Digital Workforce
              </Button>
              <Button
                kind="secondary"
                size="lg"
                onClick={() => navigate('/claims/queue')}
              >
                View Auto Claims Prototype
              </Button>
            </div>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="capabilities-section">
            <Heading>Platform Capabilities</Heading>
            <div className="capability-cards">
              <div className="capability-card">
                <Collaborate size={32} />
                <h3>Digital Workforce</h3>
                <p>
                  Design and deploy specialized AI agents across your organization. Our agent catalog provides
                  pre-built solutions for common business processes, while our orchestration tools enable complex
                  multi-agent workflows.
                </p>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowRight}
                  onClick={() => navigate('/digital-workforce')}
                >
                  Learn More
                </Button>
              </div>

              <div className="capability-card">
                <Security size={32} />
                <h3>Enterprise Governance</h3>
                <p>
                  Built-in governance controls ensure AI agents operate within defined boundaries. Confidence
                  thresholds, human review requirements, and comprehensive audit logging provide the oversight
                  enterprises demand.
                </p>
              </div>

              <div className="capability-card">
                <DataVis_1 size={32} />
                <h3>Industry Solutions</h3>
                <p>
                  Vertical-specific implementations demonstrate real-world applications. Our Auto Claims solution
                  showcases how intelligent agents can transform insurance operations with automated decision support.
                </p>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowRight}
                  onClick={() => navigate('/claims/queue')}
                >
                  View Prototype
                </Button>
              </div>

              <div className="capability-card">
                <Rocket size={32} />
                <h3>Rapid Development</h3>
                <p>
                  AI-powered agent generation, visual orchestration design, and comprehensive simulation tools
                  accelerate development. Test and validate agent behavior before deployment to ensure reliability.
                </p>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowRight}
                  onClick={() => navigate('/simulator')}
                >
                  Try Simulator
                </Button>
              </div>
            </div>
          </div>
        </Column>
      </Grid>
    </div>
  );
};

// PROJECT IMAGINE - AI-Powered Digital Workforce Platform
