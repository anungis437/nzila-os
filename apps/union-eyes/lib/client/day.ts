/** A calendar date ("YYYY-MM-DD") as the day that was recorded: parsed and shown in UTC, so a western time zone never shows the day before. */
export function formatDay(day: string, locale: string, style: 'medium' | 'long' = 'medium'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}
