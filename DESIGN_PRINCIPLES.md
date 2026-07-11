# Design Principles

Read this before making any UI change — new component, new page, restyling an
existing one, or reviewing a design brought in from elsewhere (v0, Figma, a
screenshot, another model). This applies whether you're Claude, v0, or
anything else touching this codebase. If a brief conflicts with something
here, follow this file and flag the conflict rather than silently picking one.

## The rules

1. **Reuse before adding.** Before introducing a new button, modal, icon, or
   pattern, check whether an existing interaction already covers the need.
   Extending an existing control (a new option in a `<select>`, a new tab, a
   new row in a list) beats a net-new UI element next to it.
2. **One primary action per screen.** Every screen/modal has exactly one
   button that reads as "the" action (`.btn.gold` — see below). Everything
   else is secondary (`.btn.ghost`) or a plain text/icon control. If a screen
   is growing a second thing that feels primary, that's a sign it should
   split into two screens, not two gold buttons.
3. **Preserve established spacing, typography, and motion.** Don't invent a
   new spacing scale, font stack, or transition curve for one component. Pull
   from what's already in `App.css`/Tailwind config (see tokens below). If
   the existing scale genuinely doesn't fit, that's worth a comment, not a
   silent one-off value.
4. **Reuse tokens before creating new ones.** New colors, spacing values, or
   font sizes need a real reason. Check the CSS custom properties on `.root`
   and the existing utility classes first — see "Design tokens" below.
5. **Consistency wins ties.** If a suggestion (from a design tool, a mockup,
   a user request) conflicts with an existing pattern, default to matching
   the existing pattern unless the new approach is a clear, articulable
   usability improvement — not just "different" or "trendier."
6. **When in doubt, cut, don't decorate.** If a screen feels unfinished, the
   fix is usually removing something competing for attention, not adding a
   badge/icon/border to fill the space. This app has a habit of accumulating
   nested boxes (a bordered card inside a bordered card) — that's the
   specific noise pattern to watch for and flatten.

## Design tokens (don't reinvent these)

Defined as CSS custom properties on `.root` in `src/App.css` — reference
`var(--name)`, don't hardcode the hex again:

| Token | Hex | Use |
|---|---|---|
| `--void` / `--void2` | `#0E0620` / `#1A0B33` | page background gradient |
| `--panel` | `#1D1038` | card/panel backgrounds |
| `--violet` | `#8B2FC9` | primary accent, borders |
| `--magenta` | `#D94BF0` | secondary accent |
| `--cyan` | `#3EE7F5` | interactive/focus/active accent |
| `--yellow` | `#F5D93E` | the "gold" primary-action color |
| `--liliac` | `#C9C2E8` | secondary text on dark backgrounds |
| `--white` | `#F4EFFF` | primary text |
| `--dim` | `#9D8FC4` | tertiary/muted text, labels |

Board square colors (`--boardLight`/`--boardDark`) are theme-driven — see
`src/utils/boardColors.js` — never hardcode board colors outside that file.

Fonts: **Arial Black / Impact** (italic, uppercase) for buttons, headers, and
anything meant to feel like brand/UI chrome. Default system stack for body
copy and anything read at length (descriptions, analysis text, chat-style
content). Don't introduce a third font family.

## Component patterns already established

- **Buttons**: `.btn` (primary gradient), `.btn.gold` (the one primary
  action), `.btn.ghost` (secondary, transparent + border). Every plain
  `<button>` needs an explicit `bg-*`/`bg-transparent` Tailwind class or
  background CSS — this project's Tailwind setup skips `preflight`, so an
  unstyled button silently renders native OS chrome. This has caused a real
  bug before; don't reintroduce it.
- **Modals**: `.promoOv` (overlay) + `.promoBox` (content), with a
  `.modalCloseX` in the corner. Escape key and backdrop-click both close.
  New modals should follow this shape, not invent a new overlay pattern.
- **Nav**: one `TopNav` (`src/components/ExploreNav.jsx`) rendered at the top
  of every non-home page — not per-page custom headers, not a second nav
  pattern for a new page.
- **Cards/panels**: rounded corners, `border` + translucent `background`,
  `backdrop-blur-sm` where layered over the starfield. Don't nest a bordered
  box inside another bordered box for the same piece of content — pick one
  boundary.
- **Icons**: inline SVG paths with `fill="currentColor"`, sized via explicit
  `width`/`height`. Pixel-art sprites (`PixelAvatar.jsx`) only for
  characters/mascots, not general UI icons.
- **Focus states**: `:focus-visible` with a `2px solid var(--cyan)` outline —
  every new interactive element needs this, not just mouse/touch styling.

## Applying this to outside suggestions

When a design comes from a tool that doesn't know this codebase (v0,
Figma-to-code, a pasted screenshot, another model's output): treat it as
**visual/layout reference only**. Re-implement using this project's actual
components, tokens, and state — never import generated markup/CSS wholesale,
and never let a reference's mock data or stub logic replace this app's real
state and handlers.
