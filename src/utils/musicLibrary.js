/* Real-MP3 playlists, streamed from a public Supabase Storage bucket --
   the "juice"/"xxx" folders line up 1:1 with the two playlists the user
   uploads via the Supabase dashboard (see AGENTS.md / setup notes for the
   exact bucket layout expected). Sits alongside the synthesized chiptune
   player in chiptune.js rather than replacing it -- this module only
   knows how to list/resolve tracks, playback itself is driven by a plain
   HTMLAudioElement in App.jsx so the two sources can share the same
   play/pause/next/prev/volume UI. */
const BUCKET = "music";

export const MP3_PLAYLISTS = [
  { id: "juice", label: "Juice", folder: "juice" },
  { id: "xxx", label: "XXX", folder: "xxx" },
];

const trackCache = new Map();

/** Returns [{ name, url }] for a playlist, sorted by filename. Empty array
 *  (rather than throwing) if the bucket/folder doesn't exist yet or
 *  Supabase isn't configured -- an empty playlist should read as "nothing
 *  uploaded yet", not crash the Juice Box. */
export async function loadPlaylistTracks(supabase, playlist) {
  if (!supabase) return [];
  if (trackCache.has(playlist.id)) return trackCache.get(playlist.id);
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(playlist.folder, { sortBy: { column: "name", order: "asc" } });
    if (error || !data) return [];
    const tracks = data
      .filter(f => /\.mp3$/i.test(f.name))
      .map(f => {
        const path = `${playlist.folder}/${f.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name.replace(/\.mp3$/i, ""), url: pub.publicUrl };
      });
    trackCache.set(playlist.id, tracks);
    return tracks;
  } catch {
    return [];
  }
}
