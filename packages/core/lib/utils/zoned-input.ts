// <input type="datetime-local"> values ("2026-11-07T09:30") in the store's time zone (the TIMEZONE
// setting), so the server and the browser render the same text and staff see store time.

function zonedParts(date: Date, time_zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function toZonedInput(iso: string, time_zone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : zonedParts(date, time_zone);
}

// The inverse: the wall-clock time in `time_zone` as an ISO instant ("" stays "").
export function fromZonedInput(value: string, time_zone: string): string {
  if (!value) return "";
  const as_utc = new Date(`${value}:00Z`);
  if (Number.isNaN(as_utc.getTime())) return "";
  // The zone's offset at that moment: how far its wall clock is from UTC. Applied twice so
  // times next to a daylight-saving change land on the right side.
  let guess = as_utc.getTime();
  for (let step = 0; step < 2; step++) {
    const wall = new Date(`${zonedParts(new Date(guess), time_zone)}:00Z`).getTime();
    guess = as_utc.getTime() - (wall - guess);
  }
  return new Date(guess).toISOString();
}
