---
tags: [chessboard, lessons]
---

# Lessons Learned

Things that surprised us. Distinct from [[Build Log]] — the log is *what
happened*, this is *what to remember*.

Add an entry whenever something cost more than an hour, or whenever a
decision gets made for a reason that won't be obvious later.

## Format

```markdown
### Short title
**What happened:** the symptom
**Why:** the actual cause
**Rule:** what to do differently
```

---

## Known before we started

These came out of the planning phase — traps identified from the spec rather
than learned the hard way. Written down so they stay avoided.

### ADC2 is dead while WiFi is on
**What happened:** N/A — caught in planning.
**Why:** The ESP32's ADC2 block is claimed by the WiFi radio. Analog reads
on those pins return garbage the moment WiFi connects, which looks exactly
like a broken sensor.
**Rule:** Mux signal lines go to ADC1 only — GPIO 32–39.

### Hall sensors at 5V can kill an ADC pin
**What happened:** N/A — caught in planning.
**Why:** SS49E idles near half its supply voltage. At 5V that's ~2.5V idle
and swings above it, past the ESP32's 3.3V input limit.
**Rule:** Run the sensors off the 3.3V rail. Less sensitivity, no dead pins.

### Perfboard can't hold a 55mm grid
**What happened:** N/A — caught in planning.
**Why:** Perfboard is a 2.54mm hole pitch. 55mm is 21.65 holes — not an
integer, so cells drift progressively off-centre across the board.
**Rule:** Plywood deck drilled to arbitrary spacing, not perfboard. Perfboard
only for the dense control cluster.

### Tempered glass cannot be modified
**What happened:** N/A — caught in planning.
**Why:** Tempering is the last manufacturing step. Cutting or drilling
afterwards shatters it.
**Rule:** Box dimensions final *before* the glass is ordered.

### Charge-only USB cables look like dead boards
**What happened:** N/A — known classic.
**Why:** Many USB cables carry power but no data lines. The ESP32 powers up,
the LED lights, and nothing appears on the serial port.
**Rule:** Confirm the cable is a data cable before debugging anything else.

---

## Learned during the build

*(empty — fill as we go)*
