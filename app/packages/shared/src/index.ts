export type LanguageCode = "sunda" | "jawa" | "bali" | "bugis" | "minang";

export type UserSummary = {
  username: string;
  xp: number;
  streak: number;
  level: number;
  lessonsCompleted: number;
};

export type LessonItem = {
  id: string;
  word: string;
  meaning: string;
  language: LanguageCode;
  phonetic: string;
  difficulty: "starter" | "core" | "advanced";
  tag: string;
  culturalNote?: string;
};

export type PronunciationScoreResult = {
  score: number;
  xpGained: number;
  feedback: string;
  pronunciationMatch: boolean;
};

export type CultureItem = {
  title: string;
  fact: string;
  region: string;
};

export const supportedLanguages: LanguageCode[] = ["sunda", "jawa", "bali", "bugis", "minang"];

export const lessonCatalog: Record<LanguageCode, LessonItem[]> = {
  sunda: [
    {
      id: "sd-01",
      word: "halo",
      meaning: "halo",
      language: "sunda",
      phonetic: "ha-lo",
      difficulty: "starter",
      tag: "sapaan",
      culturalNote: "Ungkapan sapaan umum dalam percakapan sehari-hari di Sunda.",
    },
    {
      id: "sd-02",
      word: "mangga",
      meaning: "silakan",
      language: "sunda",
      phonetic: "man-ga",
      difficulty: "starter",
      tag: "undangan",
      culturalNote: "Sering digunakan untuk menyambut tamu atau mengajak orang lain.",
    },
    {
      id: "sd-03",
      word: "sabaraha",
      meaning: "berapa",
      language: "sunda",
      phonetic: "sa-ba-ra",
      difficulty: "core",
      tag: "tanya",
      culturalNote: "Kata penting saat bertanya dalam situasi jual beli atau orientasi.",
    },
    {
      id: "sd-04",
      word: "hatur nuhun",
      meaning: "terima kasih",
      language: "sunda",
      phonetic: "ha-tur nu-hun",
      difficulty: "core",
      tag: "ucapan",
      culturalNote: "Sopan santun dalam budaya Sunda menempatkan ucapan syukur sebagai hal utama.",
    },
    {
      id: "sd-05",
      word: "sajeroning",
      meaning: "di dalam",
      language: "sunda",
      phonetic: "sa-je-ro-ning",
      difficulty: "advanced",
      tag: "lokasi",
      culturalNote: "Kata ini sering muncul dalam kalimat formal atau sastra Sunda.",
    },
  ],
  jawa: [
    {
      id: "jw-01",
      word: "salam",
      meaning: "salam",
      language: "jawa",
      phonetic: "sa-lam",
      difficulty: "starter",
      tag: "sapaan",
    },
    {
      id: "jw-02",
      word: "matur nuwun",
      meaning: "terima kasih",
      language: "jawa",
      phonetic: "ma-tur nu-wun",
      difficulty: "core",
      tag: "ucapan",
    },
    {
      id: "jw-03",
      word: "pira",
      meaning: "berapa",
      language: "jawa",
      phonetic: "pi-ra",
      difficulty: "starter",
      tag: "tanya",
    },
  ],
  bali: [
    {
      id: "bl-01",
      word: "om swastiastu",
      meaning: "selamat pagi",
      language: "bali",
      phonetic: "om swas-ti-as-tu",
      difficulty: "starter",
      tag: "sapaan",
    },
    {
      id: "bl-02",
      word: "terima kasih",
      meaning: "terima kasih",
      language: "bali",
      phonetic: "te-ri-ma ka-sih",
      difficulty: "starter",
      tag: "ucapan",
    },
  ],
  bugis: [
    {
      id: "bg-01",
      word: "sala",
      meaning: "selamat",
      language: "bugis",
      phonetic: "sa-la",
      difficulty: "starter",
      tag: "sapaan",
    },
  ],
  minang: [
    {
      id: "mn-01",
      word: "salamaik",
      meaning: "selamat",
      language: "minang",
      phonetic: "sa-la-maik",
      difficulty: "starter",
      tag: "sapaan",
    },
  ],
};

export const getLessonSet = (language: LanguageCode, limit = 10) =>
  lessonCatalog[language].slice(0, Math.max(1, Math.min(limit, lessonCatalog[language].length)));

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

const levenshtein = (left: string, right: string) => {
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
};

export const calculatePronunciationScore = (
  targetWord: string,
  spokenWord: string,
): PronunciationScoreResult => {
  const target = normalizeText(targetWord);
  const spoken = normalizeText(spokenWord);

  if (!target || !spoken) {
    return {
      score: 0,
      xpGained: 0,
      feedback: "Pelafalan belum bisa dinilai. Coba ulang kata dengan jelas.",
      pronunciationMatch: false,
    };
  }

  const maxLength = Math.max(target.length, spoken.length);
  const distance = levenshtein(target, spoken);
  const similarity = 1 - distance / maxLength;
  const score = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  let feedback = "Pelafalan cukup baik. Terus latihan agar lebih halus.";
  if (score >= 90) feedback = "Sangat bagus! Pengucapan kamu sudah mendekati target.";
  else if (score >= 75) feedback = "Bagus, masih ada sedikit penyesuaian pada suku kata.";
  else if (score >= 50) feedback = "Cukup dekat, latihan kecil lagi agar lebih jelas dan lancar.";
  else if (score >= 25) feedback = "Mendekati, tapi perlu lebih fokus pada vokal dan intonasi.";
  else feedback = "Pelafalan masih jauh dari target. Coba dengarkan kembali dan ulang.";

  return {
    score,
    xpGained: score >= 70 ? 15 : 8,
    feedback,
    pronunciationMatch: score >= 70,
  };
};

export const buildLeaderboard = <T extends { username: string; xp: number }>(users: T[]) =>
  [...users].sort((left, right) => right.xp - left.xp);

export const getLevelFromXp = (xp: number) => Math.max(1, Math.floor(xp / 100) + 1);

export * from "./domain/streak";
