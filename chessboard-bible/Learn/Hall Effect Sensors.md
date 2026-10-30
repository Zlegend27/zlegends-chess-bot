---
tags: [chessboard, learn]
---

# Hall Effect Sensors

Example note — written ahead of time to show the shape. Rewrite it in your
own words after [[Roadmap|H1]] and it'll be worth more than this version.

### What it is

A chip that outputs a voltage depending on the magnetic field around it. No
moving parts, nothing to wear out. Ours (**SS49E**) is *linear* — the output
slides smoothly with field strength rather than snapping on and off.

### Why this project needs it

It's how the board knows a piece is there. Each square gets one sensor; each
piece gets a magnet in its base.

The important part is **polarity**. The output sits at an idle voltage with
no magnet, rises with one pole facing it, and falls with the other. So:

| Reading | Means |
|---|---|
| below idle | one magnet orientation |
| ≈ idle | empty square |
| above idle | the other orientation |

Put magnets north-up in white pieces and south-up in black, and each square
reports three states instead of two. That's what makes a capture visible —
the target square doesn't go empty, it *changes colour*.

A reed switch would only give you occupied/empty, and captures would be
invisible to the hardware.

### What confused me

*(fill this in — it's the section future-you will actually reread)*

Likely candidates:
- "Linear" doesn't mean digital. There's no on/off, just a number you have
  to interpret with thresholds you choose.
- Idle isn't 0V. It's roughly half the supply voltage, and it drifts a
  little with temperature.

### Gotchas

- **Run it at 3.3V, not 5V.** At 5V the idle sits near 2.5V and swings above
  it — past the ESP32's 3.3V ADC limit. See [[Lessons Learned]].
- **Orientation is permanent.** The sensor has a face; the magnet has a
  pole. Get either backwards and the square reports the wrong colour
  forever. Verify with a compass before gluing anything.
- **Field strength falls off fast with distance.** Every millimetre of glass
  between magnet and sensor costs you signal. This is why the glass is 4–5mm
  and not 6mm.
- **Temperature drift is real.** Idle wanders slightly as the box warms up,
  which is why calibration stores a per-sensor baseline instead of one
  global threshold, and why the enclosure gets ventilation.

### Reference

- SS49E datasheet
- [[Analog vs Digital]] — why this needs an ADC, not a GPIO read
- [[Calibration]] — turning raw readings into three reliable states
