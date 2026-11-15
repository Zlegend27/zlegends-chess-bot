/* Opens a lobby or match channel, private if it can be.

   A private channel only lets in signed-in players the database rules
   allow (supabase/008_lobby_access.sql): anyone signed in for a lobby, and
   only the two players themselves for a match. A public channel lets in
   anyone holding the site's public key.

   Signed-in players ask for the private one first. If that's refused (the
   SQL hasn't been run yet) they fall back to the public one, so the lobby
   keeps working either way; once the SQL is in and public access is turned
   off in Supabase's Realtime settings, only the private one exists. Local
   development guests aren't signed in, so they only ever use the public
   one (which stops working for them once public access is off). */
const FAILED = new Set(["CHANNEL_ERROR", "TIMED_OUT"]);

/** `build(channel)` adds the listeners (and is called again if the channel
 *  is reopened as public); `onStatus(status, channel)` gets every status of
 *  the channel in use. Returns { close() }. */
export function openChannel(supabase, name, config, { signedIn, build, onStatus }) {
  let channel = null;
  let closed = false;
  let fellBack = false;
  const open = (isPrivate) => {
    channel = supabase.channel(name, { config: { ...config, private: isPrivate } });
    build(channel);
    const mine = channel;
    channel.subscribe((status) => {
      if (closed || mine !== channel) return;
      if (isPrivate && !fellBack && FAILED.has(status)) {
        fellBack = true;
        supabase.removeChannel(mine);
        open(false);
        return;
      }
      onStatus(status, mine);
    });
  };
  open(!!signedIn);
  return { close() { closed = true; if (channel) supabase.removeChannel(channel); } };
}
