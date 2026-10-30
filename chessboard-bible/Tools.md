---
tags: [chessboard, parts]
---

# Tools

Tick what you already own. Everything unticked in **Mandatory** blocks a
specific arc — the "needed by" column says which.

Tools are reusable across every project you ever do after this one, so
they're worth buying properly once rather than twice.

---

## Mandatory — electronics

| Have | Tool | Needed by | Est. | Notes |
|---|---|---|---|---|
| [ ] | Soldering station | H4 | $60–100 | **Hakko FX-888D** or **Pinecil V2**. Temperature control is the thing that matters — a fixed-temp iron will make you hate soldering and blame yourself. |
| [ ] | Solder, 0.8mm rosin core | H4 | $10 | Leaded 63/37 is far easier to learn on than lead-free. Wash your hands. |
| [ ] | Multimeter | H1 | $25 | Continuity + DC voltage is all you need. AstroAI is fine; Klein or Brymen if you want it to outlive the project. |
| [ ] | Breadboard + jumper kit | H1 | $15 | Get one with a power rail. |
| [ ] | Wire strippers | H3 | $12 | Self-adjusting saves real time on 200+ wires. |
| [ ] | Flush cutters | H3 | $10 | Engineer or Hakko. Cheap ones crush instead of cutting. |
| [ ] | Helping hands / third hand | H4 | $20 | Two hands, iron, solder, and a wire is four objects. |
| [ ] | USB **data** cable for ESP32 | H1 | — | Charge-only cables are the classic first-hour trap. |

## Mandatory — assembly

| Have | Tool | Needed by | Est. | Notes |
|---|---|---|---|---|
| [ ] | Cordless drill | H6 | $50 | For the sensor deck holes. |
| [ ] | Brad point bits | H6 | $15 | Clean flat-bottomed holes; twist bits wander. |
| [ ] | Clamps ×4 | H8 | $25 | Never enough clamps. |
| [ ] | Sandpaper, assorted grits | H8 | $8 | |
| [ ] | Steel rule + square | H6 | $15 | Sensor deck accuracy is what keeps squares aligned to the etched glass. |
| [ ] | Hobby knife | H8 | $6 | Baffles, diffuser film, felt. |

---

## Strongly recommended

| Have | Tool | Est. | Why |
|---|---|---|---|
| [ ] | Solder wick / desoldering pump | $10 | You will make mistakes across 128 components. |
| [ ] | Heat shrink assortment + heat gun | $20 | A hair dryer does not get hot enough. |
| [ ] | Kapton or masking tape | $8 | Holding parts while soldering. |
| [ ] | Label maker or masking tape + pen | $5 | 64 sensors and 4 mux boards. Label as you go or regret it. |
| [ ] | Anti-static mat / strap | $15 | Cheap insurance for the ESP32. |
| [ ] | Digital calipers | $20 | Magnet recesses, glass thickness, square pitch. |

---

## Deliberately NOT buying

Outsourcing the enclosure means skipping the expensive end of woodworking
entirely. See [[Parts Inventory|Trip 4]].

- ~~Table saw~~
- ~~Router + rabbet bit~~
- ~~Mitre saw~~
- ~~Custom PCB fabrication~~ — hand-wired deck is functionally identical

A walnut case with a glass rabbet is a genuinely hard first woodworking
project. A shop does it better in a week. You keep every bit of the
electronics work, which is the interesting part.

---

## Software — all free

| Have | Tool | Purpose |
|---|---|---|
| [ ] | **PlatformIO** (VS Code extension) | Firmware. Better dependency handling than Arduino IDE — recommended. |
| [ ] | Arduino IDE | Alternative, simpler, fine for early arcs |
| [x] | VS Code | Already using it |
| [x] | Git / GitHub | Already using it |
| [x] | Node + Vite | The app itself |
| [ ] | Obsidian | This vault |

Serial monitor comes with PlatformIO or Arduino IDE — no separate terminal
tool needed.

---

## Buying notes

For **ESP32, level shifter, multiplexers** — buy from Adafruit, SparkFun,
DigiKey, or Mouser. Counterfeits are real, and a clone ESP32 with a fake
USB-serial chip will cost you an evening before you think to suspect the
board rather than your code.

For **magnets, wire, perfboard, felt, consumables** — anywhere is fine. A
bad one is obvious and costs cents.
