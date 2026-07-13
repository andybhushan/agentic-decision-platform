import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Tag, TextInput } from "@carbon/react";
import { Close, IbmWatsonxAssistant, SendFilled } from "@carbon/icons-react";
import { askCopilot, type AssistMessage } from "../services/assistClient";

// The operator copilot dock for the platform console: a Microsoft Agent Framework agent
// with journal, records, and Fabric Data Agent tools behind POST /api/copilot. Source
// chips show which tools grounded each answer; subject ids deep-link into Decision Mode.

const TOOL_LABELS: Record<string, string> = {
  journal: "Decision journal",
  records: "Subject records",
  "fabric-data-agent": "Fabric IQ Data Agent",
};

const STARTERS = [
  "Which subjects are waiting for a human judgment right now?",
  "How many claims by incident type are in the portfolio?",
  "List recent claims with photo evidence and what our AI saw",
  "How many runs has each digital worker decided this week?",
];

interface ChatEntry extends AssistMessage {
  tools?: string[];
}

// Subject ids in replies become links into Decision Mode; markdown emphasis markers are
// stripped (the dock renders plain text, not markdown).
function Linkified({ text }: { text: string }) {
  const parts = text.replaceAll("**", "").split(/((?:CLM|LOAN)-\d{4}-\d{4,6})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^(?:CLM|LOAN)-\d{4}-\d{4,6}$/.test(p) ? (
          <Link key={i} to={`/decisions/${encodeURIComponent(p)}`}>
            {p}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default function CopilotDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const next: ChatEntry[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setBusy(true);
    try {
      const { reply, toolsUsed } = await askCopilot(next.map(({ role, content }) => ({ role, content })));
      setMessages([...next, { role: "assistant", content: reply || "I could not find an answer just now.", tools: toolsUsed }]);
    } catch {
      setError("The copilot is unavailable right now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button type="button" className="adp-assist__launcher" onClick={() => setOpen(true)} aria-label="Open platform copilot">
          <IbmWatsonxAssistant size={24} />
          <span>Platform copilot</span>
        </button>
      )}
      {open && (
        <div className="adp-assist adp-assist--copilot" role="dialog" aria-label="Platform copilot">
          <div className="adp-assist__head">
            <div>
              <p className="adp-assist__brand">Platform copilot</p>
              <p className="adp-assist__sub">Microsoft Agent Framework · journal + records + Fabric IQ Data Agent</p>
            </div>
            <button type="button" className="adp-assist__close" onClick={() => setOpen(false)} aria-label="Close copilot">
              <Close size={20} />
            </button>
          </div>
          <div className="adp-assist__body" ref={bodyRef}>
            <div className="adp-assist__msg adp-assist__msg--bot">
              Ask about the whole portfolio: open gates, subjects, evidence, analytics. Answers are grounded in the
              decision journal, the records, and the Fabric IQ Data Agent, and I will show which sources I used.
            </div>
            {messages.length === 0 && (
              <div className="adp-assist__starters">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`adp-assist__msg adp-assist__msg--${m.role === "user" ? "me" : "bot"}`}>
                {m.role === "assistant" ? <Linkified text={m.content} /> : m.content}
                {m.tools && m.tools.length > 0 && (
                  <span className="adp-assist__tools">
                    {m.tools.map((t) => (
                      <Tag key={t} size="sm" type={t === "fabric-data-agent" ? "cyan" : t === "journal" ? "purple" : "blue"}>
                        {TOOL_LABELS[t] ?? t}
                      </Tag>
                    ))}
                  </span>
                )}
              </div>
            ))}
            {busy && (
              <div className="adp-assist__msg adp-assist__msg--bot adp-assist__typing" aria-label="Copilot is working">
                <span /><span /><span />
              </div>
            )}
            {error && <div className="adp-assist__error">{error}</div>}
          </div>
          <form
            className="adp-assist__input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <TextInput
              id="copilot-input"
              labelText=""
              hideLabel
              placeholder="Ask across the portfolio..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <Button type="submit" size="md" hasIconOnly iconDescription="Send" renderIcon={SendFilled} disabled={busy || !input.trim()} />
          </form>
          <p className="adp-assist__note">Operator copilot on a demonstration platform; all data synthetic.</p>
        </div>
      )}
    </>
  );
}
