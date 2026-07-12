import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, IconButton, Tag } from "@carbon/react";
import { ArrowLeft, ArrowRight, Close } from "@carbon/icons-react";
import { DEMO_BEATS } from "./beats";

// The narrator: a docked guided-tour card over the live console. It never blocks
// interaction (the demo runs underneath); Next/Back also navigate to each beat's page.

const STORAGE_KEY = "adp-console-demo-beat";

interface NarratorDockProps {
  open: boolean;
  onClose: () => void;
}

export default function NarratorDock({ open, onClose }: NarratorDockProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(() => {
    const stored = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored >= 0 && stored < DEMO_BEATS.length ? stored : 0;
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(index));
  }, [index]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(DEMO_BEATS.length - 1, next));
      setIndex(clamped);
      navigate(DEMO_BEATS[clamped].path);
    },
    [navigate],
  );

  if (!open) return null;
  const beat = DEMO_BEATS[index];

  return (
    <aside className="adp-narrator" aria-label="Guided demo narration" role="complementary">
      <div className="adp-narrator__head">
        <Tag type="blue" size="sm">Guided demo</Tag>
        <span className="adp-narrator__progress">
          {index + 1} / {DEMO_BEATS.length}
        </span>
        <IconButton kind="ghost" size="sm" label="Close guided demo" align="left" onClick={onClose}>
          <Close size={16} />
        </IconButton>
      </div>
      <h4 className="adp-narrator__title">{beat.title}</h4>
      <p className="adp-narrator__text">{beat.narration}</p>
      {beat.action && <p className="adp-narrator__action">{beat.action}</p>}
      <div className="adp-narrator__nav">
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} disabled={index === 0} onClick={() => go(index - 1)}>
          Back
        </Button>
        {index < DEMO_BEATS.length - 1 ? (
          <Button size="sm" renderIcon={ArrowRight} onClick={() => go(index + 1)}>
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={onClose}>
            Finish
          </Button>
        )}
      </div>
    </aside>
  );
}
