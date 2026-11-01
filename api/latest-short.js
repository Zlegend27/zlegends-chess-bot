/* The newest YouTube Short on the channel, for the TV on Home.

   YouTube's feed doesn't say which uploads are Shorts, so this reads the
   channel's Shorts tab (newest first) and takes its first entry's title and
   date from the feed. It runs on the server because YouTube doesn't allow
   browsers to read these pages directly.

   Vercel caches the answer for an hour, so the channel is checked at most
   once an hour no matter how many people open the site. */
const CHANNEL_HANDLE = "Zlegend27";
const CHANNEL_ID = "UC37m20fElWAcq9_E0vR2iNg";
const ONE_HOUR = 60 * 60;
const UA = "Mozilla/5.0 (compatible; zlegends-chess-bot)";

/** The newest Short's id from a Shorts-tab page, or null. */
export function newestShortId(html) {
  const m = /"videoId":"([A-Za-z0-9_-]{11})"/.exec(html || "");
  return m ? m[1] : null;
}

/** Title and date for one video from the channel's Atom feed, or null. */
export function entryFor(feedXml, id) {
  const entries = (feedXml || "").match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const entry = entries.find((e) => e.includes(`<yt:videoId>${id}</yt:videoId>`));
  if (!entry) return null;
  const title = /<title>([^<]*)<\/title>/.exec(entry)?.[1] ?? "";
  const published = /<published>([^<]*)<\/published>/.exec(entry)?.[1] ?? null;
  return { id, title: decodeXml(title), published };
}

const decodeXml = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The title of a video as the Shorts page itself shows it, for when the
 *  channel feed can't be reached. Date is unknown from this source. */
export function titleFromShortsPage(html, id) {
  /* Each Short on the page carries an accessibility label like
     "Title, 939 views - play Short". Take the title out of that. */
  const m = new RegExp(`shorts-shelf-item-${id}"[\\s\\S]{0,600}?"accessibilityText":"((?:[^"\\\\]|\\\\.)*)"`).exec(html || "");
  if (!m) return null;
  const label = decodeXml(m[1].replace(/\\"/g, '"'));
  const title = label.replace(/\s-\splay Short$/, "").replace(/,\s(?:No views|[\d,.]+\s(?:views?))$/, "");
  return { id, title, published: null };
}

export default async function handler(req, res) {
  try {
    const shortsPage = await fetch(`https://www.youtube.com/@${CHANNEL_HANDLE}/shorts`, { headers: { "User-Agent": UA } }).then((r) => r.text());
    /* The feed gives titles and dates, but YouTube sometimes fails it on its
       own. The Shorts page alone is enough to show the video. */
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, { headers: { "User-Agent": UA } })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
    const id = newestShortId(shortsPage);
    const video = id && (entryFor(feed, id) || titleFromShortsPage(shortsPage, id));
    if (!video) throw new Error("no short found");
    res.setHeader("Cache-Control", `s-maxage=${ONE_HOUR}, stale-while-revalidate=3600`);
    res.status(200).json(video);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "Couldn't check for the latest Short." });
  }
}
