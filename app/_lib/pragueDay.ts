/**
 * Prague-midnight day boundaries, shared by the browser energy cache and the
 * server-side store. Both sides have to agree on which day it is, or a player
 * would see one number in the navbar and the API would enforce another.
 *
 * Deliberately free of "use client" and of any React import: this module is
 * pulled into route handlers as well as components.
 */

const TIME_ZONE = "Europe/Prague";

const PRAGUE_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The wall clock a person in Prague is reading at this instant. */
function pragueWallClock(instant: Date): Wall {
  const parts = PRAGUE_CLOCK.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // some engines say "24" at exactly midnight
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far Prague's clock runs ahead of UTC at this instant (+1h or +2h). */
function pragueOffsetMs(instant: Date): number {
  const wall = pragueWallClock(instant);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  // Drop the milliseconds the formatter never reported, so the difference is
  // the zone offset alone.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Current calendar day in Prague, as YYYY-MM-DD (day boundary = Prague midnight). */
export function pragueDayKey(now: Date = new Date()): string {
  const wall = pragueWallClock(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** Milliseconds remaining until the next Prague midnight (when energy refills). */
export function msUntilReset(now: Date = new Date()): number {
  const wall = pragueWallClock(now);
  const nextMidnightWall = Date.UTC(wall.year, wall.month - 1, wall.day + 1);

  // Twice a year the day is 23 or 25 hours long, so counting down "24h minus
  // the time on the clock" is an hour out. Convert the next local midnight to a
  // real instant instead, using the offset that will be in force when it lands.
  const firstGuess = nextMidnightWall - pragueOffsetMs(now);
  const instant = nextMidnightWall - pragueOffsetMs(new Date(firstGuess));

  return Math.max(0, instant - now.getTime());
}
