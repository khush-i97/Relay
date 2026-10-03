const sfDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function sfLocalDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError("Invalid date");
  const parts = Object.fromEntries(sfDateFormatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
