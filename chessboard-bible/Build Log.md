---
tags: [chessboard, log]
---

# Build Log

Newest entry at the top. This is the interface between the hardware and
software tracks — if it's written here, both of us can act on it.

Keep entries short. The value is in the *numbers* and the *surprises*, not
in prose.

## Entry template

```markdown
## YYYY-MM-DD — Arc H_/S_ — one-line summary

**Goal:** what this session was trying to achieve
**Result:** worked / partly / failed

**Numbers:**
- readings, thresholds, distances, voltages

**What broke:**
- and what fixed it

**Next:**
- the single next thing
```

Anything that surprised you also goes in [[Lessons Learned]]. Anything that
changes a component or quantity goes in [[Parts Inventory]].

---

## 2026-07-30 — Planning complete

**Goal:** settle the design before spending money.

**Result:** done. Architecture, BOM, tools, and roadmap agreed.

**Decisions locked:**
- Analog Hall sensors (SS49E) for colour detection, not reed switches
- Frosted tempered glass over a commissioned hardwood box
- No custom PCB — plywood sensor deck, hand-wired
- Bought clear acrylic pieces for v1, magnets glued + felted, not drilled
- Phone in a cradle beside the board, not embedded under the glass
- ESP32 holds no chess logic; it's a sensor and display peripheral

**Open questions:**
- Magnet crosstalk distance through 4–5mm glass — resolved at H5
- Whether etched squares or LED-drawn squares look better — test at H4
- Final square pitch, pending crosstalk result

**Next:**
- Zlegend: [[Parts Inventory|Trip 1]]
- Claude: S1, simulated board feed
