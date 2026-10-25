/** Campus time is always Asia/Dhaka (UTC+06:00), on both server and browser. */
export function formatMessageTime(value: string): string {
  const instant = new Date(value).getTime();
  if (!Number.isFinite(instant)) return "";

  // Avoid host timezone and ICU punctuation differences during hydration.
  const campusTime = new Date(instant + 6 * 60 * 60 * 1000);
  const hour = campusTime.getUTCHours();
  const minute = String(campusTime.getUTCMinutes()).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}
