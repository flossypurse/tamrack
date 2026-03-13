/**
 * Compute a human-readable time range string from an array of { date: string } objects.
 * Returns something like "Jan 2006 – Mar 2026 · 20yr" or "Mar 2024 – Mar 2026 · 2yr".
 */
export function computeTimeRange(data: { date: string }[]): string {
  if (!data.length) return "";

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const dates = data
    .map((d) => {
      try {
        const dt = new Date(d.date);
        if (isNaN(dt.getTime())) return null;
        return dt;
      } catch {
        return null;
      }
    })
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dates.length) return "";

  const first = dates[0];
  const last = dates[dates.length - 1];

  const fmtDate = (d: Date) => `${months[d.getMonth()]} ${d.getFullYear()}`;

  // Calculate span
  const diffMs = last.getTime() - first.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let span = "";
  if (diffDays < 60) {
    span = `${diffDays}d`;
  } else if (diffDays < 365) {
    span = `${Math.round(diffDays / 30)}mo`;
  } else {
    const years = diffDays / 365.25;
    span = years >= 2
      ? `${Math.round(years)}yr`
      : `${Math.round(diffDays / 30)}mo`;
  }

  return `${fmtDate(first)} – ${fmtDate(last)} · ${span}`;
}
