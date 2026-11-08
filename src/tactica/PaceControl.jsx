import { PACES } from "./pace";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)]";

/** Full / Quick / Off for attack cinematics, as one row of three. */
export default function PaceControl({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span id="tacticaPaceLabel" className="text-[10px] uppercase tracking-wide text-white/60">Attack cinematics</span>
      <div role="radiogroup" aria-labelledby="tacticaPaceLabel" className="flex overflow-hidden rounded-full border border-white/25">
        {PACES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            onClick={() => onChange(p.id)}
            className={"flex-1 cursor-pointer border-0 px-3 py-1.5 text-xs font-bold " + (value === p.id ? "bg-[var(--cyan)] text-black " : "bg-transparent text-white ") + focusRing}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
