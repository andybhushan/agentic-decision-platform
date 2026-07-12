import { useState } from 'react';
import { CodeSnippet, Button, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Copy, Download } from '@carbon/icons-react';
import type { Agent } from '../types';
import { generateAgentDSL, generateDetailedAgentDSL, generateWorkflowDSL } from '../utils/dslGenerator';
import './DSLPreview.scss';

interface DSLPreviewProps {
  agent: Agent;
  variant?: 'simple' | 'detailed' | 'workflow' | 'all';
  showActions?: boolean;
}

export const DSLPreview = ({ agent, variant = 'simple', showActions = true }: DSLPreviewProps) => {
  const [copied, setCopied] = useState(false);

  const simpleDSL = generateAgentDSL(agent);
  const detailedDSL = generateDetailedAgentDSL(agent);
  const workflowDSL = generateWorkflowDSL(agent);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (variant === 'all') {
    return (
      <div className="dsl-preview">
        <Tabs>
          <TabList aria-label="DSL variants">
            <Tab>Simple</Tab>
            <Tab>Detailed</Tab>
            <Tab>Workflow</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className="dsl-content">
                {showActions && (
                  <div className="dsl-actions">
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Copy}
                      onClick={() => handleCopy(simpleDSL)}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Download}
                      onClick={() => handleDownload(simpleDSL, `${agent.name.replace(/\s+/g, '_')}_simple.dsl`)}
                    >
                      Download
                    </Button>
                  </div>
                )}
                <CodeSnippet type="multi" feedback="Copied to clipboard" hideCopyButton={!showActions}>
                  {simpleDSL}
                </CodeSnippet>
              </div>
            </TabPanel>

            <TabPanel>
              <div className="dsl-content">
                {showActions && (
                  <div className="dsl-actions">
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Copy}
                      onClick={() => handleCopy(detailedDSL)}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Download}
                      onClick={() => handleDownload(detailedDSL, `${agent.name.replace(/\s+/g, '_')}_detailed.dsl`)}
                    >
                      Download
                    </Button>
                  </div>
                )}
                <CodeSnippet type="multi" feedback="Copied to clipboard" hideCopyButton={!showActions}>
                  {detailedDSL}
                </CodeSnippet>
              </div>
            </TabPanel>

            <TabPanel>
              <div className="dsl-content">
                {showActions && (
                  <div className="dsl-actions">
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Copy}
                      onClick={() => handleCopy(workflowDSL)}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Download}
                      onClick={() => handleDownload(workflowDSL, `${agent.name.replace(/\s+/g, '_')}_workflow.dsl`)}
                    >
                      Download
                    </Button>
                  </div>
                )}
                <CodeSnippet type="multi" feedback="Copied to clipboard" hideCopyButton={!showActions}>
                  {workflowDSL}
                </CodeSnippet>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    );
  }

  // Single variant display
  let dsl = simpleDSL;
  let filename = `${agent.name.replace(/\s+/g, '_')}_simple.dsl`;

  if (variant === 'detailed') {
    dsl = detailedDSL;
    filename = `${agent.name.replace(/\s+/g, '_')}_detailed.dsl`;
  } else if (variant === 'workflow') {
    dsl = workflowDSL;
    filename = `${agent.name.replace(/\s+/g, '_')}_workflow.dsl`;
  }

  return (
    <div className="dsl-preview">
      <div className="dsl-content">
        {showActions && (
          <div className="dsl-actions">
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Copy}
              onClick={() => handleCopy(dsl)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Download}
              onClick={() => handleDownload(dsl, filename)}
            >
              Download
            </Button>
          </div>
        )}
        <CodeSnippet type="multi" feedback="Copied to clipboard" hideCopyButton={!showActions}>
          {dsl}
        </CodeSnippet>
      </div>
    </div>
  );
};

// Made with Bob