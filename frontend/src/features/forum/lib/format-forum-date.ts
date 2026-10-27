const forumTimestampFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

export function formatForumTimestamp(timestamp: string) {
  return forumTimestampFormatter.format(new Date(timestamp));
}
