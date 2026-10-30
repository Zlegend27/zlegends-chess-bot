# Physical Sensor Chessboard — Build Plan

An electronic chessboard that reports piece positions to the app over WiFi,
and lights its own squares for hints and legal-move display.

**Owner-only feature.** Lazy-loaded, unlisted route — the CV/board code never
ships in the bundle other visitors download.

---

## 1. How it works

```
[64 Hall sensors] --> [4x analog mux] --> [ESP32] --WiFi/WebSocket--> [app]
[64 RGB LEDs]     <-------- 1 data pin ----'                            |
                                                                        |
                        [S9 in a cradle beside the board] <-------------'
```

The ESP32 reads all 64 squares, sends a board state, and receives light
commands. It holds no chess logic at all — it's a sensor/display peripheral.
Every rule, every legal move, every engine call stays in the app you already
have.

### What the sensors actually tell you

Analog Hall sensors detect magnetic **polarity**, not just presence. Put
magnets north-up in white pieces and south-up in black, and each square
reports one of three states: empty, white piece, black piece.

That third bit of information is what makes captures detectable. With
occupancy-only sensing, a capture is invisible — the target square was
occupied before and is occupied after. With polarity, it flips colour.

You still can't tell a rook from a bishop. You don't need to: the app knows
what's on every square from game state, and legal-move generation resolves
the rest.

### Why LEDs aren't optional

On a non-motorised board, when the bot plays Nf3, something has to tell you
which piece to move on its behalf. Lighting the from/to squares *is* the
bot's move. The hint button and legal-move dots are the same mechanism
reused.

---

## 2. Bill of materials

Prices are rough and vary a lot by supplier — check before ordering. Part
numbers are stable commodity parts, searchable anywhere.

| Part | Search term | Qty | Est. |
|---|---|---|---|
| Microcontroller | `ESP32 DevKitC WROOM-32` | 1 | $8 |
| Hall sensors | `SS49E linear hall sensor` (100pk) | 64 | $15 |
| Analog multiplexer | `CD74HC4067 16 channel breakout` | 4 | $8 |
| Addressable LEDs | `WS2811 5V pixel string 12mm 50ct` | 2 strings | $30 |
| Level shifter | `74AHCT125` | 1 | $3 |
| Magnets | `8x3mm N52 neodymium disc` (100pk) | 64 | $18 |
| Power supply | `5V 5A power adapter 5.5x2.1mm` | 1 | $14 |
| Barrel jack + caps + resistors | `1000uF 16V`, `470 ohm`, `DC jack` | — | $6 |
| Sensor deck | 6mm plywood or MDF, ~460x460mm | 1 | $12 |
| Control perfboard | `70x90mm double sided protoboard` | 2 | $6 |
| Hookup wire | `22AWG solid core kit`, multiple colours | — | $12 |
| Headers / Dupont | `2.54mm header kit` | — | $8 |
| Top surface | frosted tempered glass, 4–5mm, cut to order | 1 | $60–120 |
| Diffuser | `LED diffuser film` or 2mm opal acrylic | 1 | $15 |
| Square baffles | foam board or 3D-printed 8x8 grid | 1 | $10 |
| Enclosure | hardwood — walnut / oak / maple | — | $40–100 |
| Panel connectors | `panel mount DC jack`, `panel mount USB-C` | 2 | $10 |
| Pieces | `clear acrylic chess set` / `lucite chess set` | 1 set | $30–70 |
| Felt | 3mm craft felt sheet, self-adhesive | 1 | $6 |
| Consumables | solder, heatshrink, epoxy, wood glue, finish | — | $25 |

**≈ $250–400**, driven mostly by glass, wood species, and the piece set.

The electronics core is ~$95 and unchanged. Everything above that is finish
— so you can build and fully debug a working board cheaply, then upgrade the
surface later without touching a line of firmware or app code.

### Substitutions

- **Tight on budget:** reed switches instead of SS49E saves ~$10, but you
  lose colour detection and captures become inference-only. Works, less
  robust. Don't cut the LEDs instead — they're the whole experience.
- **Less soldering:** pixel strings (above) come pre-wired. The cheaper path
  is a WS2812B strip at 60/m cut into 64 singles and re-wired at 55mm pitch —
  saves maybe $15, costs you ~190 solder joints.
- **No custom PCB.** Functionality is identical either way, and the sensor
  deck (§4) is cheaper and more flexible. Revisit only if you ever build a
  second one.

---

## 3. Electrical decisions that will bite you

These are the four things that cost an evening each if you don't know them
up front.

### Run the Hall sensors at 3.3V, not 5V

SS49E accepts 2.7–6.5V. At 5V its idle output sits near 2.5V and swings
above that with field polarity — **which can exceed the ESP32's 3.3V ADC
limit and damage the pin.** Run the sensors from the ESP32's 3.3V rail
instead. Idle lands near 1.65V and the full swing stays in range. You lose
some sensitivity; it's still plenty.

### Only ADC1 works while WiFi is on

The ESP32's ADC2 is claimed by the WiFi radio and reads garbage whenever
WiFi is active. **Use ADC1 pins only — GPIO 32–39.** Four mux signal lines
go to GPIO 32, 33, 34, 35. (34–39 are input-only, which is fine for analog.)

### Level-shift the LED data line

WS2812B wants roughly 0.7 × 5V ≈ 3.5V for a reliable logic high. The ESP32
outputs 3.3V. It often works on the bench and then flickers in the finished
build. Put the data line through a **74AHCT125** buffer powered at 5V.

Also standard practice: **470Ω resistor** in series with the data line, and a
**1000µF capacitor** across the LED power rail near the first pixel.

### Power the LEDs separately from the ESP32

64 pixels at full white is nearly 4A. You'll never do that, but don't route
it through the dev board's regulator regardless. Separate 5V rail, **common
ground with the ESP32**, and cap global brightness in firmware (~40% is
plenty behind diffusion).

Charge the S9 from its own normal charger. Don't try to run everything off
one supply.

---

## 4. Physical build

### Frosted glass, wooden box, hidden electronics

The internals are not on display. That means diffusion is back on, and
frosted glass does several jobs at once: spreads the LEDs into even square
glow, hides the hardware, feels premium, and shows fingerprints less than
clear glass would.

### The depth conflict, and how to resolve it

Diffusion wants **distance** between LED and surface. Magnetic coupling
wants the sensors **close** to the surface. Same axis, opposite directions.

**Resolution: stop using air gap as the diffuser.** Bond a diffuser film or
2mm opal acrylic to the underside of the glass and let the material do the
work optically rather than geometrically. Then ~10–15mm of gap is enough,
and the sensors stay close enough to read reliably.

Baffles between cells come back — and they're free now, since nobody sees
them.

### Layer stack, top to bottom

```
  4–5mm frosted tempered glass  <- pieces sit here
  diffuser film / 2mm opal      <- bonded to glass underside
  10–15mm gap + 8x8 baffles     <- stops light bleeding between squares
  LED + sensor board            <- SS49E at cell centre, WS2812B alongside
  wiring bay                    <- ESP32, PSU, cable runs
  wooden base + access panel
```

Internal depth works out at **50–70mm**. That's substantial, which suits a
piece meant to feel like furniture.

### The sensor deck — plywood, not perfboard

No custom PCB. But **don't use perfboard for the 64-cell grid either**, for
a reason that isn't obvious: perfboard is on a 2.54mm hole pitch, and a
55mm square is 21.65 holes. Not an integer. Every cell would drift off
centre relative to the holes, and a sensor even slightly off-centre reads
weakly or trips its neighbour.

**Use a 6mm plywood or MDF sheet as the sensor deck instead.** Drill it at
whatever spacing you actually want, push the sensors through from below so
they sit flush with the top face, mount the LEDs alongside, and hand-wire
point to point on the underside.

This is cheaper than perfboard, more rigid, easier to mount in the box, and
frees you to use true 55mm squares (440mm playing area) instead of
contorting the geometry to fit a hole grid.

Keep a small piece of perfboard for the control cluster only — ESP32,
the four muxes, level shifter, power input. That circuitry *is* dense and
perfboard suits it fine.

**Make a drilling template.** A scrap of hardboard with the 64 positions
marked once, then reused to mark the deck, guarantees consistency far
better than measuring 64 times.

### Squares: printed, or drawn in light

With uniform frosted glass you have two options:

1. **Print or paint the squares** on the glass underside in translucent
   ink, so they read as a board when powered off and light up when on.
2. **Leave the glass blank and let the LEDs define the board entirely** —
   light squares lit warm-white, dark squares off. Striking, very "digital
   board", but the board disappears when unpowered and you burn power
   continuously just to show the grid.

(1) is the safer call. (2) is worth prototyping on four squares if the look
appeals — it's the kind of thing that's either stunning or gimmicky and you
won't know until you see it lit.

### Glass specifics

- **Tempered, not annealed.** Annealed cracks into blades; tempered breaks
  into pebbles. Tempering is the final step, so it cannot be cut or drilled
  afterward — every dimension must be final when you order.
- **Frosted / acid-etched or sandblasted**, not clear. Diffuses the LEDs,
  hides the internals, and hides fingerprints better than clear glass.
- **4–5mm, not 6mm.** Every millimetre of thickness is magnetic coupling you
  don't get back.
- **Order it with the box dimensions settled**, since it drops into a rabbet
  in the wooden frame and can't be trimmed later.

---

## 5. The wooden enclosure

The box is what makes this feel like an object rather than a project.

### Construction

- **Hardwood frame** (walnut, oak, maple) with mitred or splined corners.
  Solid hardwood is worth it here — this is the part you touch and look at.
- **Rabbet the top inside edge** so the glass sits flush with the frame
  rather than proud of it. Cut the rabbet to the glass thickness plus a
  hair, and bed the glass on thin silicone or foam tape so it isn't glass
  directly on wood.
- **Removable base panel** on screws, not glued. You will be going back
  inside this thing — for a failed sensor, a reflashed ESP32, a rewired
  cell. Magnetic catches or brass inserts beat drywall-style screws into
  end grain.
- **Ventilation.** 64 LEDs and an ESP32 in a sealed box will warm up. A few
  discreet slots or a mesh-backed opening in the base is enough; heat
  matters because Hall sensor output drifts with temperature.

### Cable routing

Two things leave the box: **DC barrel jack** for the 5V supply, and a
**USB-C pass-through** for the phone. Put both on the back edge in
recessed panel-mount connectors, so nothing dangles from a hole.

### Phone placement

The phone sits **beside** the board in a cradle, angled toward the player —
not under the glass. Simpler to mount, removable, and it reads as a display
rather than a buried component.

Build the cradle into the box's back edge or as a matching hardwood stand.
Route its USB-C internally to the pass-through so only one cable leaves the
whole assembly.

### Feel

Weight is doing a lot of work here. Glass, hardwood, and a 50–70mm body
already give you heft. Felt or cork on the underside finishes it and stops
it sliding on a table.

### Sensor placement

Sensor at square centre, bonded as close under the glass as the stack
allows. The LED can sit offset — light spreads, magnetic coupling doesn't.
Field strength falls off fast with distance, so every millimetre you shave
off the sensor-to-magnet gap buys reliability.

Magnets in the pieces are covered in §8.

---

## 6. Tools

Checklist for what you have vs. what you need. **Need** means the build
stalls without it; **nice** means there's a workable substitute.

> Tick things off in [Tools](chessboard-bible/Tools.md) rather than here —
> that copy has the checkboxes, model recommendations, and which arc each
> tool unblocks. This section is the reference list.

### Electronics

| Tool | | Notes |
|---|---|---|
| Temperature-controlled soldering iron | need | ~400 joints ahead of you. A fixed-temp $10 iron will make you hate this project. **Hakko FX-888D**, or **Pinecil V2** for a lot less money and nearly as good |
| Solder, 0.8mm | need | 60/40 leaded flows easier if you're not practised; lead-free is fine with more heat |
| Flux pen or paste | need | The difference between clean joints and a bad afternoon |
| **Multimeter** | need | You'll be checking 64 sensor outputs and hunting continuity. Non-negotiable |
| Wire strippers | need | For 22AWG |
| Flush cutters | need | |
| Breadboard + jumper wires | need | Phase 1 rig |
| USB cable for ESP32 | need | Must be a **data** cable, not charge-only — a classic hour lost |
| Helping hands or small vise | nice | Third hand for 128 components |
| Solder wick / desolder pump | nice | You will make mistakes |
| Heat gun | nice | Lighter works for heatshrink |
| Logic analyser | optional | Only if WS2812B timing misbehaves |

### Woodworking

| Tool | | Notes |
|---|---|---|
| Saw — mitre saw, or hand saw + mitre box | need | Frame corners |
| Drill / driver | need | |
| Drill bits — brad point set | need | Clean holes in the sensor deck |
| Forstner bit, 12mm | need | LED node holes |
| Clamps, 4+ | need | Glue-ups. You always want more than you have |
| Wood glue | need | |
| Square + steel rule + tape | need | |
| Sandpaper, 120–320 grit | need | |
| Router or table saw | nice | For the glass rabbet — but see the two-layer trick in §5 |
| Random orbital sander | nice | Hand sanding a box this size is tedious, not impossible |
| Chisel | nice | Cleaning up corners |

### Layout & assembly

| Tool | | Notes |
|---|---|---|
| Digital calipers | need | Magnet, sensor, glass, piece-base dimensions all matter to fractions of a mm |
| Centre punch | need | Stops the drill wandering on 64 holes |
| Drilling template (shop-made) | need | Hardboard scrap, marked once, reused. Far more consistent than measuring 64 times |
| Two-part epoxy | need | Magnets into piece bases |
| Craft knife | need | Felt, foam baffles, diffuser film |
| Compass or spare magnet | need | **Verifying magnet polarity before you glue.** Get one backwards and that piece reads as the wrong colour forever |
| Circle punch, 40mm + 8mm | nice | Felt bases — scissors work, less neatly |
| 3D printer | nice | Baffle grid. Foam board and a knife is the substitute |

### Software

| Tool | | Notes |
|---|---|---|
| Arduino IDE or PlatformIO | need | PlatformIO if you're comfortable in VS Code |
| ESP32 board support package | need | Installed through the IDE's board manager |
| FastLED or Adafruit NeoPixel | need | LED driving |
| A WebSocket library for ESP32 | need | Board ↔ app link |
| Serial monitor | need | Built into both IDEs |

### Safety

| Tool | | Notes |
|---|---|---|
| Safety glasses | need | Drilling, cutting, and solder splash |
| Fume extraction or a fan + open window | need | Don't breathe flux smoke for 400 joints |
| Nitrile gloves | need | Epoxy |
| Dust mask | need | MDF dust in particular is nasty |

---

## 7. Firmware and protocol

> **Sequencing lives in the vault, not here.** The arc-by-arc plan — what to
> build in what order, across the hardware and software tracks — is in
> [Roadmap](chessboard-bible/Roadmap.md). This file is the reference spec.

ESP32 firmware:
- scan all 64 channels through the muxes, ~20–50Hz
- debounce: a square must hold a new state for N consecutive scans before
  it's reported (stops flicker while a hand hovers)
- on any change, push the full 64-square state as JSON over WebSocket
- accept a light command: array of `{square, r, g, b}`
- calibration mode: capture per-square idle baselines with an empty board and
  store to NVS, so each sensor gets its own threshold

Board state per square: `0` empty, `1` white, `2` black.

### Colour semantics

Once the board works, the LED vocabulary:

| Colour | Meaning |
|---|---|
| Green | Legal quiet move |
| Red | Legal capture |
| Amber | Hint — from and to |
| Blue | The bot's move, waiting for you to make it |
| Flashing red | Illegal placement, or board desynced |

---

## 8. The pieces

### Bought clear set, v1

Standard pieces for now, custom later. On an underlit board, **translucent
pieces glow from within when their square lights** — a hint doesn't just
mark a square, it illuminates the piece standing on it.

What to buy: **clear acrylic / lucite chess sets** are the target. Sold
widely, usually as a clear-vs-frosted or clear-vs-smoked pair, which
conveniently gives you your two colours.

**Avoid glass piece sets** despite the matching aesthetic. You need a magnet
in every base, and glass needs diamond bits and water cooling to drill, with
a high crack rate. Acrylic is the practical choice precisely because it's
workable.

### Adding magnets without drilling

The obvious approach is to drill a recess in each base. Acrylic drills
acceptably but cracks if you rush it, and you'd be doing it 32 times on
pieces you can't replace individually.

**Better: glue the magnet to the underside and hide it in the felt.**

1. Epoxy the 8×3mm magnet dead centre on the base underside
2. Cut a 3mm felt circle to the base diameter, punch an 8mm hole in its
   centre
3. Glue the felt down so the magnet sits flush inside the hole

No drilling, no crack risk, and it's *better* magnetically — the magnet ends
up at the very bottom of the piece rather than recessed a few mm up inside
it, which is free coupling you'd otherwise lose to the glass thickness.

Felt on the base is standard on chess pieces anyway, so it reads as
finished rather than improvised.

### Constraints, whether bought or custom later

| Requirement | Why |
|---|---|
| Flat base, roughly 38–40mm | Centres the magnet over the sensor on a 55mm square |
| Magnet dead centre | Off-centre magnets read weakly or trip neighbours |
| Consistent orientation per colour | North-up for one colour, south-up for the other — this is how the board tells white from black |
| **Non-ferrous weights only** | Steel near the magnet distorts the field the sensor reads. Brass, zinc, or tungsten only |
| Low centre of gravity | Glass is slippery and tall pieces tip |

That fourth row is the non-obvious one. Weighted pieces feel far better than
light ones, and the obvious cheap weight — steel washers — is the single
material that will actively corrupt your sensor readings.

Clear acrylic pieces are light and will slide on glass. Felt bases help; if
you want real heft later, non-ferrous only.

---

## 9. Edge cases the software must handle

| Situation | Handling |
|---|---|
| Piece lifted and returned to same square | Cancel, clear lights |
| Piece lifted, placed on illegal square | Flash red, keep lights until corrected |
| Capture, attacker lifted first | Target square colour flips — commit on landing |
| Capture, victim lifted first | Target empties, then refills opposite colour |
| Castling | Two lifts, two placements — match against legal move list |
| En passant | Captured pawn's square empties with nothing landing on it |
| Promotion | Occupancy identical to a normal push — prompt on the phone screen |
| Knocked-over piece | State change with no legal explanation → pause, show expected position |
| Board desync | Compare full state to expected, light every mismatched square |

The general rule: **never trust a single sensor event.** Score observed
changes against the legal move list and require a clear best match, or ask.
