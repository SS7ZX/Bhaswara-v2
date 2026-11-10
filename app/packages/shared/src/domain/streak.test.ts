import { describe, expect, it } from "vitest";

import { calculateCurrentStreak, computeStreakWithFreeze, toLocalDayKey } from "./streak";

describe("streak logic", () => {
  it("treats WIB early-morning activity by local calendar day instead of UTC", () => {
    const activity = new Date("2025-09-08T00:30:00+07:00");

    expect(toLocalDayKey(activity, "Asia/Jakarta")).toBe("2025-09-08");
    expect(toLocalDayKey(activity, "UTC")).toBe("2025-09-07");
  });

  it("keeps streaks aligned to local-day progression in WITA", () => {
    const activities = [
      { occurredAt: new Date("2025-09-08T00:45:00+08:00"), xpAwarded: 15 },
      { occurredAt: new Date("2025-09-09T00:20:00+08:00"), xpAwarded: 25 },
      { occurredAt: new Date("2025-09-10T00:50:00+08:00"), xpAwarded: 20 },
    ];

    expect(calculateCurrentStreak(activities, "Asia/Makassar").currentStreak).toBe(3);
  });

  it("keeps streaks aligned to local-day progression in WIT", () => {
    const activities = [
      { occurredAt: new Date("2025-09-08T00:15:00+09:00"), xpAwarded: 15 },
      { occurredAt: new Date("2025-09-09T00:40:00+09:00"), xpAwarded: 30 },
    ];

    expect(calculateCurrentStreak(activities, "Asia/Jayapura").currentStreak).toBe(2);
  });

  it("respects the weekly freeze rule and grace behavior", () => {
    const activities = [
      { occurredAt: new Date("2025-09-08T12:00:00+07:00"), xpAwarded: 25 },
      { occurredAt: new Date("2025-09-09T12:00:00+07:00"), xpAwarded: 25 },
    ];

    const result = computeStreakWithFreeze(
      activities,
      "Asia/Jakarta",
      { "2025-W36": 0 },
      { dailyMinimumXp: 10, graceDays: 1, freezesPerWeek: 1 },
    );

    expect(result.currentStreak).toBe(2);
    expect(result.holdsThroughGrace).toBe(false);
  });

  it("returns zero when the user has not reached the minimum XP for any local day", () => {
    const activities = [{ occurredAt: new Date("2025-09-08T12:00:00+07:00"), xpAwarded: 5 }];

    const result = calculateCurrentStreak(activities, "Asia/Jakarta", { dailyMinimumXp: 10 });

    expect(result.currentStreak).toBe(0);
    expect(result.lastValidDay).toBeNull();
  });
});
