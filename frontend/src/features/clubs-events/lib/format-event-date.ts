const eventDateTimeFormatter = new Intl.DateTimeFormat("en-BD", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

const eventTimeFormatter = new Intl.DateTimeFormat("en-BD", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

const eventDateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Dhaka",
});

export function formatEventStart(isoDate: string): string {
  return eventDateTimeFormatter.format(new Date(isoDate));
}

export function formatEventEnd(startsAt: string, endsAt: string): string {
  const startDate = eventDateFormatter.format(new Date(startsAt));
  const endDate = eventDateFormatter.format(new Date(endsAt));
  const formattedEnd = eventTimeFormatter.format(new Date(endsAt));

  return startDate === endDate ? formattedEnd : `${endDate}, ${formattedEnd}`;
}
