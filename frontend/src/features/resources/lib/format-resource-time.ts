const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

export function formatResourceDate(value: string) {
  return fullDateFormatter.format(new Date(value));
}

export function formatMessageTime(value: string) {
  return timeFormatter.format(new Date(value));
}
