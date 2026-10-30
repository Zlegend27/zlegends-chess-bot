---
tags: [chessboard, roadmap]
---

# Roadmap

Two tracks running in parallel, converging at fixed checkpoints.

**Why parallel:** the software can be built and fully debugged against a
simulated board feed before any hardware exists. If the tracks ran in
sequence, one of us would always be blocked — you waiting on code, me
waiting on parts. This way neither happens.

```
HARDWARE (Zlegend)        SOFTWARE (Claude)
  H1 one sensor             S1 simulated feed + move inference
  H2 polarity/colour        S2 lift detection + legal-move lighting
  H3 one LED                S3 captures, castling, promotion, desync
  H4 one full square        S4 WebSocket protocol
        |                   S5 ESP32 firmware
        +---------- C1 ----------+   firmware runs on real hardware
  H5 four squares + mux
        |
        +---------- C2 ----------+   4 real squares drive the real app
  H6 one full rank
  H7 all 64
        |
        +---------- C3 ----------+   full board, full game
  H8 enclosure integration
```

---

## Hardware track

Each arc ends with something that visibly works. Don't start the next until
the current one is boring.

### H1 — One sensor reads
Breadboard, ESP32, one SS49E, one magnet. Print the analog value to serial.
Move the magnet closer and further, watch the number change.

**Done when:** you can predict the number before you look at it.
Learn: [[Learn/Breadboards|Breadboards]], [[Learn/ESP32 Basics|ESP32 Basics]], [[Learn/Analog vs Digital|Analog vs Digital]], [[Learn/Hall Effect Sensors|Hall Effect Sensors]]

### H2 — It knows the colour
Same rig. Flip the magnet over. The value moves the *other* way from idle.
Establish the three bands: below idle, idle, above idle.

**Done when:** you can write down the two thresholds that separate
white / empty / black, and they hold over ten minutes.
Feed those numbers to Claude — they go straight into the firmware.

### H3 — One LED lights
Drop the sensors. One WS2812B, one data pin, one level shifter. Make it red,
then green, then off.

**Done when:** you can light it any colour on command.
Learn: [[Learn/WS2812B and NeoPixels|WS2812B and NeoPixels]], [[Learn/Level Shifting|Level Shifting]]

### H4 — One complete square
Sensor + LED + magnet + a scrap of glass at final thickness. Place a piece →
the square lights. Lift it → it goes out. Flip the piece colour → the colour
changes.

**This is the whole project in miniature.** Everything after is repetition.

**Done when:** it survives being left on for an hour without drifting.

### H5 — Four squares through a multiplexer
Introduces the mux. This is where you learn to address channels instead of
reading pins directly.

**Done when:** four squares report independently and *don't* trip each
other. This is the crosstalk test — the answer determines your final magnet
size and square pitch.
Learn: [[Learn/Multiplexers|Multiplexers]]

### H6 — One full rank
Eight squares on the real sensor deck, at real 55mm spacing. First time
you're building the actual thing rather than a rig.

### H7 — All 64
Repetition. Wire rank by rank; test each rank before starting the next.
Learn: [[Learn/Power Distribution|Power Distribution]]

### H8 — Enclosure integration
Glass, diffuser, baffles, wooden box, phone cradle, cable management.
Mostly assembly — the electronics are already proven.

---

## Software track

Runs from day one. Nothing here is blocked on hardware.

### S1 — Simulated feed + move inference
A fake WebSocket emitting occupancy/colour states, driven by a clickable
board in the browser. Move inference scored against the legal move list.

### S2 — Lift detection + legal-move lighting
Square empties → identify the piece → generate legal moves → emit the light
command. The feature you actually want, testable with zero hardware.

### S3 — The hard cases
Captures in both lift orders, castling, en passant, promotion prompt,
knocked-over pieces, full desync recovery. See the edge-case table in
[BOARD_BUILD.md](../BOARD_BUILD.md).

### S4 — Protocol
Freeze the JSON message shapes both directions. Once frozen, firmware and
app can be developed against it independently.

### S5 — ESP32 firmware
Mux scanning, debounce, calibration storage, LED driver, WebSocket client.
Written by Claude, flashed and tested by Zlegend.

---

## Convergence points

| | What happens | Needs |
|---|---|---|
| **C1** | Real firmware on real hardware for the first time | H4 + S5 |
| **C2** | Four physical squares drive the real app end to end | H5 + S4 |
| **C3** | Full board, full game against the bot | H7 + all S |

C2 is the one that matters. After it, everything left is repetition and
carpentry — no unknowns.

---

## Learning order

Don't read the whole spec at once. One concept per arc, in this order:

1. [[Learn/Voltage Current Ground|Voltage, current, ground]]
2. [[Learn/Breadboards|Breadboards]]
3. [[Learn/ESP32 Basics|Programming the ESP32]]
4. [[Learn/Analog vs Digital|Analog vs digital input]]
5. [[Learn/Hall Effect Sensors|Hall effect sensors]]
6. [[Learn/WS2812B and NeoPixels|WS2812B / NeoPixels]]
7. [[Learn/Level Shifting|Level shifting]]
8. [[Learn/Multiplexers|Multiplexers]]
9. [[Learn/Soldering|Soldering]]
10. [[Learn/Power Distribution|Power distribution]]
11. [[Learn/WebSockets and JSON|WebSockets and JSON]]
12. [[Learn/Calibration|Calibration]]
