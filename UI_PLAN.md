# UI Overhaul Plan

Status: approved. Phases 0 to 3 are built. Phase 4 is next.
Last updated: 2026-10-31.

The goal is for the whole app to feel like one finished product: the same
header everywhere, a home screen that gets you playing fast, and every option
living in one obvious place. This covers the main Zlegend app. Kinnda Chess
stays out unless you decide otherwise (Decision 7).

## 1. What's wrong today

These come from going through the code and measuring the app on a phone-sized
screen (375 by 812).

### The menu appears and disappears

- Home has no menu at all. Every other screen has one. This is the "menu not
  existing then coming into reality" feeling.
- Login and Music can't be reached from Home. Settings is a small icon near
  the bottom of the page.
- Opening Settings or Music from any page quietly switches to the chess board
  behind the popup, then switches back when you close it. It's why a board can
  flash up where it shouldn't.

### Home spends its space on words

- The first thing you can tap starts 402px down, almost half the phone screen.
  Above it are the title, the tagline, a paragraph, a bot speech bubble and
  "Choose a mode".
- The page is 2.1 phone screens tall.
- Six big equal tiles means nothing reads as the main thing to do.
- Rank Bot and Game Review sit in a separate "Features" section even though
  they're just as much a part of the app. "New Feature" is a label that goes
  stale.

### The options feel sloppy, and here's why

| Problem | Where you see it | Why it feels wrong |
|---|---|---|
| The menu doesn't hold your main features | The bar is Home, Login, Music, Settings | No Play, Puzzles or Lessons, so moving between them means going back to Home first |
| Destinations and settings are mixed | Game Review is a row inside Settings | Settings should change how the app behaves, not take you somewhere |
| A stat lives in Settings | "Your Rating" is a Settings row | It belongs with your profile |
| Account holds one button | The Account popup only has Sign out | A whole popup for one action |
| Your name is edited in a different place | A pencil on the game screen | It belongs with your profile |
| Same-level features open differently | Lessons, Puzzles and Review are pages. Openings, Spectate, Blind and Rush are popups on top of the board | The app doesn't teach you what to expect |
| Five ways to leave | Back, Exit, the X, the Escape key, Home | Nothing tells you which one applies |
| Two names for one thing | The menu says Music, the popup says Juice Box | Reads as two features |
| Popups that swap | Piece Designs closes Settings, then reopens it on exit | Feels jumpy compared with sliding between screens |
| A third look | Puzzles stays dark rose whatever theme you've picked | Looks like a different app in light mode |

### What the player can't see, but feels

- The app has no real page addresses. Every screen is the same URL, so the
  phone's back gesture leaves the site, and you can't link to or refresh into
  a page. Apps feel solid largely because of this.
- There are no transitions between screens.
- App.jsx alone has 102 hand-placed style blocks, and some tappable Settings
  rows aren't real buttons, so they don't work with a keyboard or screen reader.
- App.jsx is 4,418 lines. Every change is riskier until the shell is pulled
  out of it.

## 2. What the research says

| Finding | Source | What it means for us |
|---|---|---|
| Chess.com's app moved to a bar that's always at the bottom, built around its most popular features | [Chess.com v4](https://www.chess.com/news/view/chesscom-v4-ios-android) | Your main features belong in always-visible navigation |
| Its home screen shows shortcuts and personal stats, and a separate Play screen gets you into a game | Same article | Home is about you. Play is about starting a game |
| On its website, the logo doubles as Home. Top items are Play, Puzzles, Learn, Watch, News, Social, More, and rarely used tools went under More | [Chess.com navbar update](https://www.chess.com/news/view/chesscom-new-navbar-updated-search) | Make the logo the Home button and tuck rare features one level down |
| Lichess's new app deliberately chose minimalism over its old overloaded design | [Lichess app release](https://lichess.org/@/Lichess/blog/mobile-app-official-release/wiwu6goO) | Removing things is a valid goal, not a loss |
| Duolingo redesigned its home around a guided next step because learners weren't sure they were using the app correctly | [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design) | Home should answer "what should I do next?" |
| Tab bars are for moving between top-level sections, and should stay visible | [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Apple WWDC22](https://developer.apple.com/videos/play/wwdc2022/10001/) | One steady menu, not one that comes and goes |
| A home screen that repeats what's in the tabs makes people jump around | Same WWDC22 session | Once the menu exists, the six-tile grid should go, not sit beside it |
| Three to five items is the normal range for a bottom bar | [Material bottom navigation](https://chromium.googlesource.com/external/github.com/material-components/material-components-ios/+/v55.5.0/components/BottomNavigation/README.md) | Five is our ceiling on phones |
| The avatar menu is for identity, preferences, help and sign-out. Everyday features belong in the main menu | [SaaSFrame](https://www.saasframe.io/patterns/profile-menu), [SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-145/ui-elements/user-menu/usage) | This answers what goes in your profile menu |
| Group account menu items, and make the main link stand out. 71% of the shops tested failed at this | [Baymard](https://baymard.com/blog/account-drop-down-structure) | Use grouped sections, with Sign out set apart at the bottom |
| On touch screens, a user menu should open larger, not as a tiny dropdown | SAP Fiori, above | Use a sheet that slides up on phones |

Limits of this research: Chess.com's app article is from 2022, and I couldn't
confirm today's exact tabs in the Chess.com or Lichess apps. Before Phase 1,
it's worth you opening both apps on your phone for two minutes and telling me
anything you love or hate.

## 3. The strategy

### The blend you asked for

Keep the good part of a home screen with no board on it, and give it the menu
from the very first frame. The header belongs to the app, not to each page, so
it never redraws, disappears or flashes as you move around.

### One header everywhere

All the words at the top of Home go. The header replaces them.

Computer:

    [Logo]  Play   Puzzles   Learn   Review              [Your picture]

Phone (see Decision 1):

    [Logo]                                               [Your picture]
    ---------------------- page content ----------------------
    Home      Play      Puzzles      Learn      Review

### The order, and why

1. **Play**: the reason people came, so it goes first.
2. **Puzzles**: the daily habit.
3. **Learn**: improving between games.
4. **Review**: looking back at games, and new enough to deserve being seen.

Everything else moves under one of those:

| Section | What's inside |
|---|---|
| Play | Play vs Bot, Rank Bot, Blind Chess, Watch Bots (today's Spectate) |
| Puzzles | Daily Puzzle, Ranked, Rush, Leaderboard |
| Learn | Lessons, Openings Library, Theory Trainer |
| Review | Paste a game, Your games |

### Home becomes about you

The six tiles go, because the menu now does that job. Top to bottom:

1. **One big main button**: Resume Game if one is in progress, otherwise Play.
2. **Daily Puzzle**: a small board preview and your streak. This is where a
   little chess returns to Home without a full board.
3. **Your last game**: result, with a one-tap Review.
4. **One rotating suggestion**: a lesson to continue, or try Rank Bot.

A brand-new player sees the same layout with friendly starter content, and the
bot's personality can live in one short line. Goal: everything important fits
on the first phone screen.

### Login and your profile

Signed out, the header shows a clear **Log in** button. Tapping it goes
straight to Discord.

Signed in, your picture grows from 18px to about 36px, with no "Account" label.
Tapping it opens a menu: a dropdown on computers, and a sheet that slides up on
phones.

    [Big picture]  Your name
    ----------------------------
    Profile                      (your name, stats, trophies later)
    Your games
    ----------------------------
    Settings
    Music
    ----------------------------
    Discord, YouTube, TikTok
    ----------------------------
    Sign out

Signed-out players get the same menu with Settings, Music and the socials, plus
Log in at the top. Rating stays out of this menu, because you asked to hide the
number until it's properly calibrated.

Login should also feel earned instead of nagging: after a finished game, a
guest sees one small, dismissible line: "Log in to keep your games on every
device."

### One rule per kind of thing

- **Section** (Play, Puzzles): a page with its own address.
- **Sub-area** (Openings, Spectate, Rush setup): a page, not a popup on a board.
- **Quick choice** (promotion, confirm new game): a popup.
- **Options** (Settings): one page, or one sheet with sliding sub-screens.
- **Leaving**: one back arrow at the top left of anything below a section. A
  game in progress asks before leaving.

## 4. Build phases

Each phase is about one or two sessions and leaves the app working, so we can
stop anywhere. I'd show you each one before it goes live.

### Phase 0: Foundations (mostly invisible)

- Give every screen a real address, so back gestures, refresh and links work.
- Lift the header out of the pages into one shared app frame.
- Keep one list of menu items in one file.
- Update DESIGN_PRINCIPLES.md (see Risks).

Done when: phone back works everywhere, refreshing keeps you on the same page,
and nothing looks different yet.

### Phase 1: The header and profile menu

- Build the header, navigation and bigger profile picture.
- Build the profile menu and the signed-out Log in button.
- Open Settings and Music without flipping to the board behind them.

Done when: the header is identical on every screen, including Home, on phone
and computer, in both themes.

### Phase 2: The new Home

- Remove the title, tagline, paragraph and tile grid.
- Build the main button, Daily Puzzle card, last game card and suggestion.
- Build the new-player version.

Done when: a new and a returning player can each start something in one tap
from the first screen.

### Phase 3: Section pages

- New Play page, combining bot choice, Rank Bot, Blind Chess and Watch Bots.
- Tidy Puzzles, Learn and Review so they share one page layout.
- Turn Openings, Spectate, Rush setup and Ranked into pages.

Done when: every feature is reachable in two taps, and same-level features open
the same way.

### Phase 4: Settings and Profile

- Rebuild Settings with real, accessible rows.
- Move Game Review out, and name editing and rating into Profile.
- Pick one name for Music or Juice Box (Decision 4).
- Add the guest login nudge.

Done when: each option exists in exactly one place.

### Phase 5: The game screen

- Audit the controls during play, puzzles, review and practice.
- Standardise leaving a game, and hide what isn't needed mid-game.

Done when: one back rule works in every mode, and the board stays the star on a
phone.

### Phase 6: Feel and finish

- Add quick, consistent transitions between screens.
- Add loading, empty and error states on every screen.
- Check keyboard use, screen readers, and tap targets of at least 44px.
- Pass over small phones, tablets and iPhone home-screen mode.

Done when: there's no blank flash, dead end or unstyled state anywhere.

## 5. Decisions for you

Decided: 1 (bottom bar on phones), 5 (socials move to the profile menu and the
bottom of Home) and 7 (Kinnda stays out). The rest use the recommendations below
until you change them. For Decision 8, the header shows the ship icon, plus
"Zlegend2700" on wider screens.

1. **Where do the section buttons sit on a phone?** You asked for a menu header.
   I recommend the logo and picture at the top and the sections in a bottom bar,
   because that's what Chess.com does and thumbs reach it. The alternative is
   putting everything along the top, which is simpler but harder to reach on a
   big phone.
2. **Is the Home order right?** Resume or Play, Daily Puzzle, last game, then a
   suggestion.
3. **Are the section names right?** "Learn" replaces Lessons and Openings as the
   umbrella name, and "Watch Bots" replaces Spectate Bots.
4. **Music or Juice Box?** I'd keep "Juice Box" as the fun name and use it
   everywhere, but it's your brand.
5. **Where do the socials go?** I'd move them out of every page into the profile
   menu and the bottom of Home, which also clears room for a bottom bar.
6. **Should Puzzles follow the theme?** I'd keep its rose accents but let it go
   light in light mode, so it stops looking like a different app.
7. **Is Kinnda included?** I recommend leaving it alone, because a child is using
   it and it has its own design.
8. **Which name goes in the logo?** Zlegend's Chess Bot, Zlegend2700, or just the
   ship icon on phones.

## 6. Risks

- **Two written design rules changed.** DESIGN_PRINCIPLES.md now describes the
  one shared header and bottom bar. The old objection to a bottom bar was that it
  fought the social banner, and moving the socials solved that.
- **The two button styles stay.** That file says not to merge the calmer page
  style with the loud in-game style. This plan keeps both.
- **Phase 0 is the riskiest part.** App.jsx ties screens and game state closely
  together. It goes first, in small steps, with a check that games in progress
  survive moving around.
- **People's habits change.** Regular players lose the tile grid, and anything
  moving should remain reachable in no more than two taps.
- **Real iPhone testing needs you.** I can test phone sizes here, but home-screen
  mode needs your phone, as the sign-in work showed.
- **Don't start the new Home before the header.** It only works once the menu
  has taken over the tiles' job.

## 7. Still to do outside this plan

- **Reminder:** test Recent Games across devices. Sign in at zlegend2700.com on
  each browser with older games and reload. Finish a game on the iPhone app,
  then check that it appears under Your games on a computer.
