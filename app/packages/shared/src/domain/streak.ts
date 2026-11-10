export type StreakConfig = {
  dailyMinimumXp: number;
  graceDays: number;
  freezesPerWeek: number;
};

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastValidDay: string | null;
  freezeRemainingThisWeek: number;
  holdsThroughGrace: boolean;
};

export type DailyActivity = {
  occurredAt: Date;
  xpAwarded: number;
};

const ISO_DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalDayKey = (value: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
};

export const getIsoWeekKey = (value: Date, timeZone: string) => {
  const localDay = new Date(value.toLocaleString("en-US", { timeZone }));
  const day = new Date(localDay);
  const dayOfWeek = (day.getUTCDay() + 6) % 7;
  const thursday = new Date(day);
  thursday.setUTCDate(day.getUTCDate() - dayOfWeek + 3);

  const year = thursday.getUTCFullYear();
  const weekNumber = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / ISO_DAY_MS + 1) / 7);

  return `${year}-W${pad(weekNumber)}`;
};

const dayKeyToUtcDate = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const differenceInDays = (left: string, right: string) => {
  const leftDate = dayKeyToUtcDate(left).getTime();
  const rightDate = dayKeyToUtcDate(right).getTime();
  return Math.round((leftDate - rightDate) / ISO_DAY_MS);
};

export const calculateCurrentStreak = (
  activities: DailyActivity[],
  timeZone: string,
  config: Partial<StreakConfig> = {},
) => {
  const { dailyMinimumXp = 10 } = config;
  const eligibleDayKeys = [
    ...new Set(
      activities
        .filter((event) => event.xpAwarded >= dailyMinimumXp)
        .map((event) => toLocalDayKey(event.occurredAt, timeZone)),
    ),
  ].sort((left, right) => left.localeCompare(right));

  if (eligibleDayKeys.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastValidDay: null,
      freezeRemainingThisWeek: 0,
      holdsThroughGrace: false,
    } satisfies StreakState;
  }

  let longest = 1;
  let current = 1;
  let previous = eligibleDayKeys[0];

  for (let index = 1; index < eligibleDayKeys.length; index += 1) {
    const currentDay = eligibleDayKeys[index];
    const dayGap = differenceInDays(currentDay, previous);

    if (dayGap === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (dayGap > 1) {
      current = 1;
    }

    previous = currentDay;
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    lastValidDay: eligibleDayKeys[eligibleDayKeys.length - 1],
    freezeRemainingThisWeek: 0,
    holdsThroughGrace: false,
  } satisfies StreakState;
};

export const computeStreakWithFreeze = (
  activities: DailyActivity[],
  timeZone: string,
  freezeUsageByWeek: Record<string, number>,
  config: Partial<StreakConfig> = {},
) => {
  const { graceDays = 1, freezesPerWeek = 1 } = config;
  const base = calculateCurrentStreak(activities, timeZone, config);
  const todayKey = toLocalDayKey(new Date(), timeZone);
  const latestValid = base.lastValidDay ?? todayKey;
  const currentIsoWeek = getIsoWeekKey(new Date(), timeZone);
  const freezeRemainingThisWeek = Math.max(
    freezesPerWeek - (freezeUsageByWeek[currentIsoWeek] ?? 0),
    0,
  );

  const gapDays = latestValid === todayKey ? 0 : differenceInDays(todayKey, latestValid);
  const holdsThroughGrace = gapDays <= graceDays && freezeRemainingThisWeek > 0;

  return {
    ...base,
    freezeRemainingThisWeek,
    holdsThroughGrace,
  } satisfies StreakState;
};

export const isTimezoneBoundaryRisk = (timeZone: string) => {
  const jakarta = new Date("2025-09-01T00:30:00+07:00");
  const utcDate = toLocalDayKey(jakarta, "UTC");
  const localDate = toLocalDayKey(jakarta, timeZone);

  return utcDate !== localDate;
};
