import Modal from "./Modal";

/* A yes-or-cancel popup for a choice that can't be undone (quitting a game,
   starting a new one over it). Cancel, the X, the backdrop and Escape all
   leave things as they were. */
export default function ConfirmModal({ open, title, text, yesLabel, onYes, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} closeLabel="Cancel" zIndex={52} maxWidth={340} style={{ width: "min(340px, 90vw)" }}>
      <h2 className="boxHead m-0">{title}</h2>
      {text && <p className="m-0 text-sm" style={{ color: "var(--liliac)" }}>{text}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn gold" style={{ flex: 1 }} onClick={onYes}>{yesLabel}</button>
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}
