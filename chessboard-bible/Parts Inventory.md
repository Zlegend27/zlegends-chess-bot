---
tags: [chessboard, parts]
---

# Parts Inventory

Staged into five buys. **Do not buy trip N+1 until trip N has taught you
what it was supposed to.** The whole point is that a failed experiment costs
$35 instead of $300.

Status key: `[ ]` not ordered · `[~]` ordered · `[x]` received & tested

---

## Where to buy

For anything where a fake part would waste a weekend — the ESP32, the level
shifter, the multiplexers — buy from **Adafruit, SparkFun, DigiKey, or
Mouser**. Counterfeit and out-of-spec parts are a genuine problem on general
marketplaces, and a bad ESP32 clone with a fake USB-serial chip will cost
you an evening before you suspect the hardware.

For commodity items where a bad unit is obvious and cheap to replace —
magnets, wire, felt, perfboard — anywhere is fine.

**Buy Hall sensors in a 100-pack even though you need 64.** They're a few
cents each, a couple will be out of spec, and you'll break some.

---

## Trip 1 — Tools and one ESP32

Buy before anything else. This is what lets you start learning immediately.

- [ ] ESP32 DevKitC (WROOM-32) — $8–12
- [ ] Soldering station — $60–100 · *Hakko FX-888D, or Pinecil V2 for less*
- [ ] Multimeter — $25
- [ ] Breadboard + jumper wire kit — $15
- [ ] Solder, 0.8mm — $10
- [ ] Wire strippers — $12
- [ ] Flush cutters — $10
- [ ] Helping hands — $20
- [ ] **USB data cable** for the ESP32 — check it's not charge-only

**Unlocks:** [[Roadmap|H1]] and the whole learning ramp.

---

## Trip 2 — Four-square prototype

~$35. The cheap experiment that de-risks the expensive one.

- [ ] SS49E Hall sensors, 100-pack — $15
- [ ] 8×3mm N52 neodymium discs, 100-pack — $18
- [ ] WS2811 5V pixel string, 12mm nodes — $15
- [ ] CD74HC4067 mux breakout ×1 — $2
- [ ] 74AHCT125 level shifter — $3
- [ ] 470Ω resistors, 1000µF capacitor — $5
- [ ] **A scrap of glass at your final thickness** — offcut from the glass shop

That last item matters more than it looks. Testing magnet coupling through
thin acrylic and then ordering 5mm tempered glass invalidates the result.

**Unlocks:** H1 through H5, and convergence point C1.

---

## Trip 3 — Scale to 64

Only after H5 proves the geometry. Your crosstalk numbers may change the
square pitch, and that changes the deck.

- [ ] CD74HC4067 mux breakout ×3 more — $6
- [ ] WS2811 pixel string ×1 more — $15
- [ ] 5V 5A power supply — $14
- [ ] 6mm plywood/MDF sensor deck, ~460×460mm — $12
- [ ] Perfboard for the control cluster ×2 — $6
- [ ] 22AWG hookup wire, multiple colours — $12
- [ ] Header/Dupont kit — $8
- [ ] Panel-mount DC jack + USB-C — $10

---

## Trip 4 — Outsourced: glass and wood

Both commissioned, neither built. Order only when box dimensions are final.

- [ ] **Frosted tempered glass**, 4–5mm, cut to size — $60–120
      Local glass shop, or an online cut-to-order service.
      Frosted · tempered · exact dimensions. Cannot be trimmed after.
- [ ] **Hardwood enclosure** — $40–100+ commissioned
      Etsy, Facebook Marketplace, a local cabinet shop, or a maker space.
      Spec: outer frame, rabbet sized to your glass, removable bottom
      panel on screws, phone cradle, ventilation slots.

Commissioning the box is the single best time trade in this project. A
walnut case with a glass rabbet is a hard first woodworking project, and a
shop will produce something better in a week than months of learning would.
You keep all the electronics work, which is the interesting part anyway.

---

## Trip 5 — Finishing

- [ ] Clear acrylic / lucite chess set — $30–70
- [ ] LED diffuser film or 2mm opal acrylic — $15
- [ ] Foam board or 3D-printed baffle grid — $10
- [ ] 3mm self-adhesive craft felt — $6
- [ ] Two-part epoxy — $8
- [ ] Wood finish, if the box arrives raw — $15

---

## Running total

| Trip | Est. | Spent |
|---|---|---|
| 1 — Tools | $160–205 | |
| 2 — Prototype | $73 | |
| 3 — Scale | $83 | |
| 4 — Glass + wood | $100–220 | |
| 5 — Finishing | $84 | |
| **Total** | **$500–665** | |

Higher than the earlier $250–400 figure because that one assumed you owned
the tools and built the box yourself. Tools are reusable and the box is
outsourced labour — the board itself hasn't got more expensive.

---

## Received log

Fill in as things arrive. Useful later for reordering and for knowing which
supplier sent the dud.

| Date | Item | Qty | Source | Cost | Notes |
|---|---|---|---|---|---|
| | | | | | |
