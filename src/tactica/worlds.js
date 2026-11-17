/* The Rogue Chess Run's worlds: four places of ten floors each, forty floors
   in all, and then the run is won. A world has two halves of five floors:
   the second half is harder and (once the scenes are built) its background
   steps up after a short animation. A world with a boss ends on a boss
   floor: one long puzzle. Each world sets its own puzzle ratings, puzzles
   per floor, timer and what a wrong move costs.

   Each world has its own scene (sets/). Names here are plain working
   names. */
export const FLOORS_PER_WORLD = 10;

/* PLACEHOLDER STORY. Each boss's lines are stand-ins written by Claude for
   the creator to replace: `peek` when the boss is first seen close, `intro`
   on the card before the boss floor, `won` on the card after beating him. */
export const BOSS_STORY = {
  bin: {
    omen: "Something in the bin is awake",
    peek: "Two eyes are watching you from under the snow.",
    intro: ["Something has been at the bottom of this bin longer than you have.", "The cold woke it up. It is hungry, and it has decided your board is dinner."],
    won: ["The pizza monster melts back into the rubbish.", "Above you the lid hangs open, and the snow is still falling. You climb out into the cold."],
  },
  ice: {
    omen: "Across the ice, the bear is coming",
    peek: "The bear has started across the ice.",
    intro: ["Since you came onto his lake, the bear has watched you.", "Now the ice between you is gone, and so is his patience."],
    won: ["The ice gives way, and the bear goes down into the black water.", "Far off, through the snow, the sky is glowing red."],
  },
  volcano: {
    omen: "The volcano is erupting",
    peek: "The fire giant is wading toward you.",
    intro: ["The giant was here before the volcano was. He has never been beaten.", "He reaches down for the board, and the lava rises with him."],
    won: ["The fire goes out of him, and the giant crumbles into the lava.", "Beyond the smoke, something in the dark is watching."],
  },
  demon: {
    omen: "The storm breaks, and the red moon rises",
    peek: "The demon raises his weapons.",
    intro: ["Every weapon stuck in this ground belonged to someone who reached him.", "None of them won. He has been waiting for you since the bin."],
    won: ["His armour breaks apart, and the demon blows away as ash.", "The storm is gone. For the first time since the shelf, the pieces are home.", "You made it out. Together."],
  },
};

export const WORLDS = [
  { id: "bin", name: "The Bin", boss: "The pizza monster", rating: [550, 900], phases: [2, 3], baseSeconds: 30, secondsPerMove: 10, wrongMoveDamage: 25 },
  { id: "ice", name: "The Icy Lake", boss: "The polar bear", rating: [950, 1350], phases: [3, 4], baseSeconds: 30, secondsPerMove: 10, wrongMoveDamage: 25 },
  { id: "volcano", name: "The Volcano", boss: "The fire giant", rating: [1500, 1900], phases: [4, 4], baseSeconds: 25, secondsPerMove: 8, wrongMoveDamage: 34 },
  { id: "demon", name: "The Demon's Realm", boss: "The demon", rating: [1950, 2300], phases: [4, 5], baseSeconds: 25, secondsPerMove: 8, wrongMoveDamage: 34 },
];

/** The floor that ends the run. */
export const LAST_FLOOR = WORLDS.length * FLOORS_PER_WORLD;

/** Which world a floor is in (0 to 3). Floors past the end count as the last. */
export const worldIndex = (floor) => Math.min(WORLDS.length - 1, Math.floor((Math.max(1, floor) - 1) / FLOORS_PER_WORLD));
export const worldOf = (floor) => WORLDS[worldIndex(floor)];
/** A floor's place within its world, 1 to 10. */
export const floorInWorld = (floor) => ((Math.max(1, floor) - 1) % FLOORS_PER_WORLD) + 1;
export const firstFloorOf = (index) => index * FLOORS_PER_WORLD + 1;

export const isWorldStart = (floor) => floorInWorld(floor) === 1;
/** The floor where a world steps up: its sixth. */
export const isIntensify = (floor) => floorInWorld(floor) === 6;
/** The harder second half of a world. */
export const isIntense = (floor) => floorInWorld(floor) >= 6;
/** A world's last floor: its boss. */
export const isBossFloor = (floor) => floorInWorld(floor) === FLOORS_PER_WORLD && !!worldOf(floor).boss;
/** The bin's last two floors: the lid is open and it's snowing. The second
 *  is where the pizza monster is fought. */
export const isSnowFloor = (floor) => worldIndex(floor) === 0 && floorInWorld(floor) >= 9;
