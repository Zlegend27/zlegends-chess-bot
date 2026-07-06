/* Real-MP3 playlists, streamed from a public Supabase Storage bucket --
   the "juice"/"xxx" folders line up 1:1 with the two playlists the user
   uploads via the Supabase dashboard (see AGENTS.md / setup notes for the
   exact bucket layout expected). Sits alongside the synthesized chiptune
   player in chiptune.js rather than replacing it -- this module only
   knows how to list/resolve tracks, playback itself is driven by a plain
   HTMLAudioElement in App.jsx so the two sources can share the same
   play/pause/next/prev/volume UI. */
const BUCKET = "music";
/* The dashboard upload landed the playlist folders one level deeper than
   expected -- bucket root has a "music" folder, and "juice"/"omori" sit
   inside that, not at the bucket root. Prefixing every path here (instead
   of asking for a re-upload) keeps this a one-line fix if the structure
   ever gets flattened later. */
const ROOT_PREFIX = "music";

/* "theme" is a single file (the site's default track) sitting directly in
   the root music folder rather than its own subfolder -- folder:"" means
   "don't join a subfolder onto ROOT_PREFIX", so it's listed/resolved
   through the exact same code path as a real playlist and gets all the
   same next/prev/shuffle/progress-bar machinery for free. */
export const THEME_ID = "theme";
export const MP3_PLAYLISTS = [
  { id: THEME_ID, label: "Theme", folder: "" },
  { id: "juice", label: "Juice", folder: "juice" },
  { id: "omori", label: "Omori", folder: "omori" },
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
    const folderPath = playlist.folder ? `${ROOT_PREFIX}/${playlist.folder}` : ROOT_PREFIX;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folderPath, { sortBy: { column: "name", order: "asc" } });
    if (error || !data) return [];
    const tracks = data
      .filter(f => /\.mp3$/i.test(f.name))
      .map(f => {
        const path = `${folderPath}/${f.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name.replace(/\.mp3$/i, ""), url: pub.publicUrl };
      });
    trackCache.set(playlist.id, tracks);
    return tracks;
  } catch {
    return [];
  }
}
