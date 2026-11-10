import { describe, expect, it } from "vitest";

import { buildLeaderboard, calculatePronunciationScore, getLessonSet, supportedLanguages } from "./index";

describe("shared package", () => {
  it("includes Sundanese in the supported language list", () => {
    expect(supportedLanguages).toContain("sunda");
  });

  it("exposes a lesson set for the selected language", () => {
    const lessons = getLessonSet("sunda", 3);
    expect(lessons.length).toBe(3);
    expect(lessons[0].language).toBe("sunda");
  });

  it("scores pronunciation with a reasonable threshold", () => {
    const result = calculatePronunciationScore("halo", "halo");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.pronunciationMatch).toBe(true);
  });

  it("orders leaderboard entries by XP descending", () => {
    const leaderboard = buildLeaderboard([
      { username: "budi", xp: 120 },
      { username: "ani", xp: 320 },
      { username: "cici", xp: 200 },
    ]);

    expect(leaderboard[0].username).toBe("ani");
    expect(leaderboard[1].username).toBe("cici");
  });
});
