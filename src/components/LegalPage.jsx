import SubPage from "./SubPage";
import { getUiTheme } from "../utils/uiTheme";

/* The Privacy Policy and Terms of Service, at /privacy and /terms (Google's
   sign-in setup links to both). Written in plain words, and it has to match
   what the site really does: if the site starts collecting or sending
   anything new, update the policy and its date. */
const UPDATED = "November 15, 2026";
const CONTACT = "support@zlegend2700.com";

function Section({ title, children, T }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className={"m-0 text-sm font-bold " + T.ink}>{title}</h2>
      <div className={"flex flex-col gap-1.5 text-sm leading-relaxed [&_a]:text-[var(--cyan)] [&_a]:underline " + T.ink}>{children}</div>
    </section>
  );
}

function Privacy({ T }) {
  return (
    <>
      <Section title="Who we are" T={T}>
        <p className="m-0">Zlegend&apos;s Chess Bot (www.zlegend2700.com) is a free chess site run by Zlegend27. Questions about your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </Section>
      <Section title="If you play without an account" T={T}>
        <p className="m-0">Your settings, ratings and any game in progress are kept in your own browser. The site also makes a random ID for your browser (not linked to your name) and saves these with it:</p>
        <ul className="m-0 pl-5">
          <li>finished games against the bots (the moves and the result)</li>
          <li>moves played against Rank Bot, to tune its play</li>
          <li>Puzzle Rush scores, with the name you type, which is shown on the leaderboard</li>
          <li>in Blind Chess, the text of spoken moves it couldn&apos;t understand, to improve it</li>
        </ul>
      </Section>
      <Section title="If you make an account" T={T}>
        <p className="m-0">You can log in with Google, Discord or an email code. We then keep your email address, the name and profile picture that Google or Discord share, the name and look you choose on your profile, and your games and scores. Anything you did on this browser before logging in is moved onto your account.</p>
      </Section>
      <Section title="Playing other people" T={T}>
        <p className="m-0">In the 1v1 lobbies, other players see your name, your look and where you are sitting. Your moves are sent to your opponent as you play, and the game is saved to your history.</p>
      </Section>
      <Section title="Voice in Blind Chess" T={T}>
        <p className="m-0">Blind Chess uses your browser&apos;s own speech recognition. Depending on the browser, your voice may be processed by the browser&apos;s maker (for example Google, in Chrome). We never receive or keep recordings, only the text described above.</p>
      </Section>
      <Section title="Services we use" T={T}>
        <ul className="m-0 pl-5">
          <li>Supabase: the database, log-in and the live 1v1 connection</li>
          <li>Vercel: hosts the site; like any web host it keeps short-lived request logs, including IP addresses</li>
          <li>Resend: sends the email log-in codes</li>
          <li>Google and Discord: only if you choose to log in with them</li>
          <li>YouTube: the video on the home page is a YouTube player; YouTube&apos;s own policy applies when you play it</li>
        </ul>
        <p className="m-0">To improve the site we keep our own simple record of which features get used (for example that a page was opened or a puzzle solved), how you arrived, and crashes, tied to the same random ID. There are no ads and no third-party tracking or analytics tools, and we never sell your information.</p>
      </Section>
      <Section title="Age" T={T}>
        <p className="m-0">You need to be 13 or older to make an account. If you believe a child under 13 has made one, email us and we&apos;ll delete it.</p>
      </Section>
      <Section title="Your choices" T={T}>
        <p className="m-0">You can delete your account and everything saved with it from your profile page (Delete my account). To see what we hold, or if you&apos;d rather we delete it for you, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you log in with. Clearing this site&apos;s data in your browser removes what is kept there. We keep account data while the account exists.</p>
      </Section>
      <Section title="Changes" T={T}>
        <p className="m-0">If this policy changes, the date at the top changes too.</p>
      </Section>
    </>
  );
}

function Terms({ T }) {
  return (
    <>
      <Section title="Using the site" T={T}>
        <p className="m-0">Zlegend&apos;s Chess Bot is free, for fun and for learning chess. Donations through the Support link are voluntary, go through Ko-fi under its own terms, and don&apos;t buy anything on the site. By using it you agree to these terms. You need to be 13 or older to make an account, and you are responsible for keeping access to it (your Google, Discord or email).</p>
      </Section>
      <Section title="Play fair, be kind" T={T}>
        <ul className="m-0 pl-5">
          <li>Don&apos;t use engines or other help in games against people, and don&apos;t fake leaderboard scores.</li>
          <li>Don&apos;t harass other players or pick offensive names.</li>
          <li>Don&apos;t try to break, overload or get around the site&apos;s rules.</li>
        </ul>
        <p className="m-0">We may remove names or scores, or close accounts, that break these rules.</p>
      </Section>
      <Section title="Your content" T={T}>
        <p className="m-0">Names and looks you choose stay yours; you let us show them on the site (for example on the leaderboard and in the lobbies).</p>
      </Section>
      <Section title="No guarantees" T={T}>
        <p className="m-0">The site is offered as it is. Features can change or stop, games and ratings can be lost, and the site may be unavailable at times. As far as the law allows, we aren&apos;t liable for losses from using it.</p>
      </Section>
      <Section title="Other sites and open source" T={T}>
        <p className="m-0">Links to other sites (Chess.com, Lichess, YouTube, Discord) follow those sites&apos; own terms. The site&apos;s code and the open-source parts it uses are listed with their licenses on <a href="https://github.com/Zlegend27/zlegends-chess-bot/blob/main/NOTICE.md" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      </Section>
      <Section title="Contact and changes" T={T}>
        <p className="m-0">Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If these terms change, the date at the top changes too. See also the <a href="/privacy">Privacy Policy</a>.</p>
      </Section>
    </>
  );
}

export default function LegalPage({ doc, onBack, sweetheart }) {
  const T = getUiTheme(sweetheart);
  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <h1 className="boxHead m-0">{doc === "terms" ? "Terms of Service" : "Privacy Policy"}</h1>
      <p className={"m-0 text-xs " + T.dimText}>Last updated {UPDATED}</p>
      {doc === "terms" ? <Terms T={T} /> : <Privacy T={T} />}
    </SubPage>
  );
}
