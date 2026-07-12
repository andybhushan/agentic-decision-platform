import { useEffect, useRef, useState } from 'react';
import { Modal, Button, CodeSnippet, Loading } from '@carbon/react';
import { Code } from '@carbon/icons-react';
import { buildWorkforceFlowDsl, flowLegend } from '../data/workforceFlow';
import type { Workforce } from '../data/claimsWorkforce.seed';
import './WorkforceFlowModal.scss';

// Mermaid is loaded lazily so it only ships when the flow is actually opened.
let mermaid: typeof import('mermaid').default | null = null;

interface WorkforceFlowModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  outcome: string;
  /** Live workforce from Cosmos. Falls back to seed if not provided. */
  workforce?: Workforce;
}

export const WorkforceFlowModal = ({ open, onClose, title, outcome, workforce }: WorkforceFlowModalProps) => {
  const [ready, setReady] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const flowDsl = buildWorkforceFlowDsl(workforce);

  // Initialise mermaid once.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (!mermaid) {
          const mod = await import('mermaid');
          mermaid = mod.default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
          });
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('Failed to load Mermaid:', err);
        if (!cancelled) setRenderError(true);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render the diagram whenever the modal opens and mermaid is ready.
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    const render = async () => {
      try {
        const el = diagramRef.current;
        if (el && mermaid) {
          setRenderError(false);
          el.removeAttribute('data-processed');
          el.innerHTML = flowDsl;
          await mermaid.run({ nodes: [el] });
          if (cancelled) return;
        }
      } catch (err) {
        console.error('Failed to render flow diagram:', err);
        if (!cancelled) setRenderError(true);
      }
    };
    const t = setTimeout(render, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, ready]);

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading={title}
      modalLabel="End-to-end flow"
      passiveModal
      size="lg"
      className="workforce-flow-modal"
    >
      <p className="flow-outcome">
        <strong>Outcome:</strong> {outcome}
      </p>

      <div className="flow-legend" aria-label="Node types">
        {flowLegend.map((item) => (
          <span className={`flow-legend-item flow-kind-${item.kind}`} key={item.kind}>
            <span className="flow-legend-swatch" />
            {item.label}
          </span>
        ))}
      </div>

      <div className="flow-diagram-wrap">
        {!ready && !renderError && <Loading description="Loading diagram..." withOverlay={false} />}
        {renderError && (
          <p className="flow-error">
            Could not render the flow diagram. View the DSL source below instead.
          </p>
        )}
        <div id="workforce-flow-diagram" className="flow-diagram" ref={diagramRef} />
      </div>

      <Button
        kind="ghost"
        size="sm"
        renderIcon={Code}
        onClick={() => setShowSource((s) => !s)}
        className="flow-source-toggle"
      >
        {showSource ? 'Hide DSL source' : 'Show DSL source'}
      </Button>

      {showSource && (
        <CodeSnippet type="multi" feedback="Copied to clipboard" className="flow-source">
          {flowDsl}
        </CodeSnippet>
      )}
    </Modal>
  );
};
