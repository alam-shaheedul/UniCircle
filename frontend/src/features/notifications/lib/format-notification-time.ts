const notificationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

export function formatNotificationTime(value: string): string {
  return notificationDateFormatter.format(new Date(value));
}
