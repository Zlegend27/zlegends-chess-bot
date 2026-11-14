/* The signed-in player's picture: the one from Google or Discord, or their
   initial on a disc when the account has none (an email account). Used by
   the header, its menu and the profile page, so they always agree. */
export default function AccountAvatar({ profile, size = 36, className = "" }) {
  const box = { width: size, height: size };
  if (profile?.avatarUrl) {
    return <img src={profile.avatarUrl} alt="" style={box} className={"rounded-full object-cover " + className} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size * 0.45, fontFamily: "var(--font-display)", background: "var(--violet)", color: "#fff" }}
      className={"inline-flex flex-none items-center justify-center rounded-full " + className}
    >
      {(profile?.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
