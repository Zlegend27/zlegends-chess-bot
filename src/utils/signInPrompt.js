/* Opens the sign-in window (SignInSheet) from anywhere: the header, the
   profile page, the lobbies, Chess Tactica. One listener, the sheet. */
let listener = null;

export function openSignIn() { listener?.(); }

/** For SignInSheet. Returns a function that stops listening. */
export function onSignInRequest(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
