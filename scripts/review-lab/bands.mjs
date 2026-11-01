/* The rating bands the review is measured across. */
export const BANDS = ["<800", "800-1199", "1200-1599", "1600-1999", "2000-2399", "2400+"];

export function bandFor(rating) {
  if (rating < 800) return "<800";
  if (rating < 1200) return "800-1199";
  if (rating < 1600) return "1200-1599";
  if (rating < 2000) return "1600-1999";
  if (rating < 2400) return "2000-2399";
  return "2400+";
}
