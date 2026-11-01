import { describe, test, expect, vi, beforeEach } from "vitest";
import { newestShortId, entryFor } from "../../api/latest-short.js";
import { freshShort, fetchLatestShort, SHORT_TTL_MS } from "./latestShort";

const FEED = `<feed>
<entry><yt:videoId>w5JdJ66xRWg</yt:videoId><title>FACE MEEEE</title><published>2026-10-31T20:36:01+00:00</published></entry>
<entry><yt:videoId>m9RvsiZL8Cs</yt:videoId><title>Chess.com rated me &amp; I cried</title><published>2026-10-31T17:38:43+00:00</published></entry>
</feed>`;

describe("finding the newest Short", () => {
  test("the first video on the Shorts tab is the newest", () => {
    expect(newestShortId('..."videoId":"m9RvsiZL8Cs"..."videoId":"A0ro8YZVNrY"')).toBe("m9RvsiZL8Cs");
  });

  test("nothing usable means nothing", () => {
    expect(newestShortId("<html>no videos</html>")).toBeNull();
    expect(newestShortId(null)).toBeNull();
  });

  test("its title and date come from the feed, with XML entities decoded", () => {
    expect(entryFor(FEED, "m9RvsiZL8Cs")).toEqual({
      id: "m9RvsiZL8Cs", title: "Chess.com rated me & I cried", published: "2026-10-31T17:38:43+00:00",
    });
  });

  test("a Short missing from the feed is not returned", () => {
    expect(entryFor(FEED, "AAAAAAAAAAA")).toBeNull();
  });
});

describe("remembering the answer for an hour", () => {
  const video = { id: "m9RvsiZL8Cs", title: "x", published: null };

  test("fresh within an hour", () => {
    expect(freshShort({ video, fetchedAt: 1000 }, 1000 + SHORT_TTL_MS - 1)).toEqual(video);
  });

  test("stale after an hour", () => {
    expect(freshShort({ video, fetchedAt: 1000 }, 1000 + SHORT_TTL_MS)).toBeNull();
    expect(freshShort(undefined)).toBeNull();
  });
});

describe("fetching it", () => {
  const store = new Map();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  });

  test("a fresh copy is used without asking the server", async () => {
    const fetcher = vi.fn();
    store.set("zlegendsBot.latestShort", JSON.stringify({ video: { id: "m9RvsiZL8Cs" }, fetchedAt: Date.now() }));
    expect(await fetchLatestShort(fetcher)).toEqual({ id: "m9RvsiZL8Cs" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("a server failure gives null, so the TV can say so", async () => {
    expect(await fetchLatestShort(vi.fn().mockRejectedValue(new Error("offline")))).toBeNull();
    expect(await fetchLatestShort(vi.fn().mockResolvedValue({ ok: false }))).toBeNull();
  });
});
