import { useState } from "react";
import Modal from "./Modal";
import { sendFeedback } from "../utils/track";

const DISCORD = "https://discord.gg/TQtfCVkYqa";
const CONTACT = "support@zlegend2700.com";
const KINDS = [
  { id: "bug", label: "Something's wrong" },
  { id: "idea", label: "An idea" },
];

/* "Feedback" in the profile menu: report a bug or suggest something,
   without leaving the page. It's saved as a "feedback" event with the page
   and browser (track.js); read them with query 11 in supabase/stats.sql.
   Discord and email are offered too, for a conversation. */
export default function FeedbackModal({ open, onClose }) {
  const [kind, setKind] = useState("bug");
  const [text, setText] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | failed

  const close = () => { onClose(); if (state === "sent") { setText(""); setState("idle"); } };
  const send = async () => {
    if (!text.trim() || state === "sending") return;
    setState("sending");
    setState((await sendFeedback(text, kind)) ? "sent" : "failed");
  };

  return (
    <Modal open={open} onClose={close} closeLabel="Close Feedback" maxWidth={400} style={{ width: "min(400px, 92vw)", minWidth: undefined, color: "var(--white)" }}>
      <div className="boxHead">Feedback</div>
      {state === "sent" ? (
        <>
          <p className="m-0 text-sm leading-relaxed" role="status">Thanks! We read every message. If you&apos;d like a reply, tell us on Discord too.</p>
          <button type="button" className="btn gold" style={{ width: "100%" }} onClick={close}>Done</button>
        </>
      ) : (
        <>
          <div className="flex gap-2" role="radiogroup" aria-label="What is it?">
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
                className={"btn ghost" + (kind === k.id ? " on" : "")} style={{ flex: 1, minHeight: 44, textTransform: "none", ...(kind === k.id ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}) }}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            {kind === "bug" ? "What happened, and what were you doing?" : "What would make the site better?"}
            <textarea className="modalInput" rows={5} maxLength={1000} value={text} onChange={(e) => { setText(e.target.value); if (state === "failed") setState("idle"); }} />
          </label>
          <p className="m-0 text-xs leading-relaxed" style={{ color: "var(--dim)" }}>
            Sent with the page you&apos;re on and your browser, not your name or email. Please don&apos;t include personal details.
          </p>
          {state === "failed" && <p role="alert" className="pasteError m-0 text-[13px] font-bold">Couldn&apos;t send it. Check your connection and try again.</p>}
          <button type="button" className="btn gold" style={{ width: "100%" }} disabled={!text.trim() || state === "sending"} onClick={send}>
            {state === "sending" ? "Sending…" : "Send"}
          </button>
          <p className="m-0 text-center text-xs" style={{ color: "var(--dim)" }}>
            Or talk to us on <a href={DISCORD} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)" }}>Discord</a> or at <a href={`mailto:${CONTACT}`} style={{ color: "var(--cyan)" }}>{CONTACT}</a>
          </p>
        </>
      )}
    </Modal>
  );
}
