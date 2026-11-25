# Launch posts (drafts)

Written 2026-11-24 for LAUNCH_FINAL.md section 4.4. Edit freely: they're in
plain words on purpose, and every claim matches what the site does today.
Order: Discord and YouTube on launch day (soft launch), Reddit and Show HN
in week 2 if the first week goes well.

Facts used (keep them true if the site changes):
- Free, no ads, no account needed to play.
- Game Review from a Chess.com or Lichess username; accuracy fitted to 750
  public Chess.com games and checked on 750 more: within 5 points of
  Chess.com's about 83% of the time. Stockfish runs in your browser.
- Rank Bot plays like a person at your level (Maia3 human-move model) and
  adjusts as you play.
- 1,000 rated puzzles (Lichess, CC0), daily puzzle, Puzzle Rush.
- Learn: How to play chess (5 chapters), Opening Trainer (12 openings),
  Blind Chess Trainer (10-stage path from board to no board, text puzzles,
  a full game by voice).
- Chess Tactica: 3D story puzzle adventure.
- 1v1 against people, with invite links.

---

## 1. Discord announcement (launch day)

> **Zlegend2700 is live** 🎉
>
> It's a free chess site, no ads, no account needed: **https://www.zlegend2700.com**
>
> What's in it:
> • **Game Review**: type your Chess.com or Lichess username, tap a game, and every move gets graded (accuracy tuned to match Chess.com's). Unlimited, free.
> • **Rank Bot**: a bot that plays like a real person at your level and adjusts as you play.
> • **Puzzles**: a daily puzzle, ranked puzzles and Puzzle Rush.
> • **Learn**: how to play from zero, an opening trainer for 12 openings, and a Blind Chess Trainer that teaches you to see the board in your head.
> • **Chess Tactica**: a 3D chess story adventure.
> • **1v1**: play each other, or send a friend an invite link.
>
> This is the first public version, so **tell me what breaks**: the Feedback button is in the menu (top right), or drop it in #feedback. I'm fixing things daily this week.

---

## 2. YouTube

**Short (about 40 seconds), script:**

1. (Screen: Game Review, typing a username) "Chess.com gives you one free game review a day. I built one that's unlimited."
2. (Tap a game, the report fills in) "Type your username, tap a game, every move graded. The accuracy is tuned to land close to Chess.com's."
3. (Practice your mistakes) "Then it makes you practise the moves you missed."
4. (Quick cuts: Rank Bot, Puzzle Rush, Chess Tactica) "There's also a bot that plays like a human at your level, puzzles, and a 3D chess adventure."
5. (URL on screen) "It's free, no ads. zlegend2700.com."

**Video or Short description:**

> Free chess in your browser, no ads, no account: https://www.zlegend2700.com
>
> • Unlimited Game Review for your Chess.com and Lichess games
> • A bot that plays like a person at your level
> • Daily puzzle, ranked puzzles, Puzzle Rush
> • Learn chess from zero, train 12 openings, and a Blind Chess Trainer
> • Chess Tactica, a 3D chess adventure
>
> Found a bug? Use Feedback in the site's menu. Discord: https://discord.gg/TQtfCVkYqa

---

## 3. Reddit (week 2)

Before posting: read the subreddit's current rules. r/chess allows limited
self-promotion only from accounts that take part there (Reddit's "10%"
guideline); if unsure, message the moderators first. Post from your own
account, answer every comment, and don't post the same thing to several
subreddits on the same day.

**r/chessbeginners** (beginner angle):

> **Title:** I made a free site to review your games and learn to see the board in your head
>
> I'm a chess content creator and I've been building a free chess site for a while: https://www.zlegend2700.com (no ads, no account needed).
>
> Two parts I think help beginners most:
> 1. **Game Review**: type your Chess.com or Lichess username, pick a game, and see every move graded, then practise the moves you missed. Unlimited.
> 2. **Blind Chess Trainer**: short drills that start with tapping squares on a board and slowly take the board away (square colours, where a knight can go, following moves, then small puzzles read as text). It moves you on faster when you get them right.
>
> It's the first public version. If something's confusing or broken, I'd really like to know.

**r/chess** (if the rules allow it):

> **Title:** I built a free, unlimited game review that reads your Chess.com/Lichess username
>
> Type a username, tap a game, every move is graded. I tuned the accuracy formula on 750 public Chess.com games and checked it on 750 more: it lands within 5 points of Chess.com's about 83% of the time. Stockfish runs in your browser, so it costs nothing to keep it free and unlimited.
>
> https://www.zlegend2700.com/review (no ads, no account). Happy to answer questions about how it works, and I'd love to hear where it disagrees with Chess.com on your games.

---

## 4. Show HN (week 2, a weekday morning US Eastern)

Rules: only for something people can try now; title starts with
"Show HN:"; no hype words, don't ask for upvotes, don't send people a
direct link to the post. Stay in the comments for the first few hours.

**Title:** Show HN: Free chess game review that runs Stockfish in your browser

**Link:** https://www.zlegend2700.com/review

**First comment (post it yourself right after submitting):**

> Hi HN, I made this. It's a free chess site; the part I'm posting is Game Review: type a Chess.com or Lichess username, pick a game, and every move gets graded with an accuracy score.
>
> Some details that might interest people here:
>
> - Everything engine-related runs client-side: Stockfish compiled to WebAssembly grades the moves in a web worker, so the server cost of a review is zero and it can stay unlimited.
> - Chess.com doesn't publish its accuracy formula. I fitted a curve (expected points from the eval, then a stretched average) to 750 public Chess.com games across six rating bands and checked it on 750 games it hadn't seen: it's within 5 points of Chess.com's number about 83% of the time.
> - The adaptive bot uses Maia3 (a model trained on human games, from the University of Toronto's CSSLab, AGPL) to choose moves a person at your level would play, running in the browser with ONNX Runtime Web. The site's source is public because of that licence.
> - It's a Preact single-page app; the public pages are prerendered at build time so search engines and link previews get real content.
>
> Other things on the site: puzzles, a 3D chess adventure, and a "blind chess" trainer that fades the board away step by step. No ads, no tracking, no account needed.
>
> I'd especially like to hear where the grading disagrees with Chess.com or Lichess on your own games.

---

## 5. After posting

- Watch Feedback (stats query 11), crashes (query 7) and Supabase usage
  the same day.
- Reply to comments; note recurring questions for an FAQ.
- Send me anything broken; I'll fix it the same day.
