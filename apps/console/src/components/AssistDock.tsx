import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "@carbon/react";
import { Chat, Close, SendFilled } from "@carbon/icons-react";
import { askAssist, type AssistMessage } from "../services/assistClient";

// The member-facing assistant dock, shared by both branded portals. A floating launcher
// opens a chat panel; answers come from POST /api/assist, grounded server-side in the
// signed-in member's own records and journey. Honesty note stays visible in the panel.

interface AssistDockProps {
  industry: string;
  memberId: string;
  brand: string;
  greeting: string;
  starters: string[];
}

export default function AssistDock({ industry, memberId, brand, greeting, starters }: AssistDockProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistMessage[]>([]);
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
    const next: AssistMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setBusy(true);
    try {
      const reply = await askAssist(industry, memberId, next);
      setMessages([...next, { role: "assistant", content: reply || "Sorry, I could not find an answer just now." }]);
    } catch {
      setError("The assistant is unavailable right now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button type="button" className="adp-assist__launcher" onClick={() => setOpen(true)} aria-label={`Chat with ${brand}`}>
          <Chat size={24} />
          <span>Questions? Ask us</span>
        </button>
      )}
      {open && (
        <div className="adp-assist" role="dialog" aria-label={`${brand} assistant`}>
          <div className="adp-assist__head">
            <div>
              <p className="adp-assist__brand">{brand}</p>
              <p className="adp-assist__sub">Account assistant · answers from your own records</p>
            </div>
            <button type="button" className="adp-assist__close" onClick={() => setOpen(false)} aria-label="Close assistant">
              <Close size={20} />
            </button>
          </div>
          <div className="adp-assist__body" ref={bodyRef}>
            <div className="adp-assist__msg adp-assist__msg--bot">{greeting}</div>
            {messages.length === 0 && (
              <div className="adp-assist__starters">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`adp-assist__msg adp-assist__msg--${m.role === "user" ? "me" : "bot"}`}>
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="adp-assist__msg adp-assist__msg--bot adp-assist__typing" aria-label="Assistant is typing">
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
              id="assist-input"
              labelText=""
              hideLabel
              placeholder="Ask about your account..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <Button type="submit" size="md" hasIconOnly iconDescription="Send" renderIcon={SendFilled} disabled={busy || !input.trim()} />
          </form>
          <p className="adp-assist__note">AI assistant on a demonstration platform; all data synthetic.</p>
        </div>
      )}
    </>
  );
}
