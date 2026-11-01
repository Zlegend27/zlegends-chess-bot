/* A tab left open across a deploy still asks for the old build's files, which
   no longer exist, so parts of the site that load on demand fail to open.
   Reloading picks up the new build. The timestamp stops a real outage from
   reloading forever. */
const KEY = "staleBuildReload";
const RETRY_AFTER_MS = 60000;

export const isStaleBuildError = (error) =>
  /dynamically imported module|importing a module script failed/i.test(String(error?.message ?? error));

/** Reloads if `error` means the build is out of date. Returns true if so. */
export function reloadIfStaleBuild(error) {
  if (!isStaleBuildError(error)) return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) || 0) < RETRY_AFTER_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
