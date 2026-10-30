---
tags: [chessboard, process]
---

# Division of Labour

This project is half software, half physical. Being explicit about the split
stops both of us waiting on the other.

## Zlegend

Everything physical, everything that requires hands, eyes, or a wallet.

- Buying and sourcing (see [[Parts Inventory]])
- Breadboarding, soldering, drilling, assembly
- Flashing firmware to the ESP32 and reporting what it does
- **Measuring and reporting real-world numbers** — sensor readings,
  thresholds, crosstalk distances, magnet behaviour
- Commissioning the wooden enclosure and ordering the glass
- Deciding anything aesthetic
- Filming, if this becomes a series

## Claude

Everything that is text on a screen.

- App-side code: the board module, move inference, lift detection,
  legal-move lighting, all edge cases
- The simulated board feed, so software can be tested with no hardware
- **ESP32 firmware** — mux scanning, debounce, calibration, LED driver,
  WebSocket client
- Protocol design and keeping both sides in sync
- Wiring specs: which sensor goes to which mux channel, which pin does what
- Debugging support from whatever you can report — serial output,
  multimeter readings, photos
- Keeping this vault current

## Shared, with a handoff

These need both of us, in a specific order:

| Task | Claude does | Zlegend does |
|---|---|---|
| Firmware | Writes it | Flashes it, reports behaviour |
| Calibration | Encodes thresholds into firmware | Measures them on real hardware |
| Wiring | Specifies the map | Executes and verifies continuity |
| Crosstalk tuning | Adjusts detection logic | Runs the physical test, reports distances |
| Debugging | Interprets and fixes | Observes and describes |

## The important limitation

**Claude cannot see the hardware.** No serial monitor, no multimeter, no
eyes on the bench. Every hardware fact reaches me through what you report.

That makes the reporting format matter. When something misbehaves, the
useful things are:

- What you expected vs. what happened
- Raw serial output, pasted rather than described
- Multimeter readings at the relevant points
- A photo of the wiring if it's physical
- What changed since it last worked

"The sensor isn't working" is unfixable. "Idle reads 1.64V, drops to 1.61V
with the magnet at 10mm, expected a bigger swing" is fixable in one reply.

## Working rhythm

1. Claude writes the code or spec
2. Zlegend builds/flashes/measures
3. Zlegend reports the result into [[Build Log]]
4. Claude adjusts
5. Anything surprising gets written to [[Lessons Learned]]

The build log is the interface between the two tracks. Keep it current and
neither of us has to remember why something was decided three weeks ago.
