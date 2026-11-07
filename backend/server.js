const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

// ---- Data (nanti ganti ke database) ----
const LESSONS = {
  sunda: [
    { id: 1, word: "Wilujeng enjing", meaning: "Selamat pagi" },
    { id: 2, word: "Hatur nuhun", meaning: "Terima kasih" },
    { id: 3, word: "Punten", meaning: "Permisi / maaf" },
    { id: 4, word: "Sampurasun", meaning: "Salam (sapaan)" },
    { id: 5, word: "Abdi", meaning: "Saya" },
    { id: 6, word: "Cai", meaning: "Air" },
    { id: 7, word: "Imah", meaning: "Rumah" },
    { id: 8, word: "Naon", meaning: "Apa" },
    { id: 9, word: "Kumaha", meaning: "Bagaimana" },
    { id: 10, word: "Sakola", meaning: "Sekolah" },
  ],
};
const CULTURE = [
  { title: "Angklung", fact: "Alat musik bambu khas Sunda, diakui UNESCO sejak 2010." },
  { title: "Sampurasun", fact: "Salam khas Sunda, dijawab dengan 'Rampes'." },
];
const users = {}; // { username: { xp, streak, lastDay } }

const today = () => new Date().toISOString().slice(0, 10);
function getUser(name) {
  if (!users[name]) users[name] = { name, xp: 0, streak: 0, lastDay: null };
  return users[name];
}
function touchStreak(u) {
  const t = today();
  if (u.lastDay === t) return;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  u.streak = u.lastDay === y ? u.streak + 1 : 1;
  u.lastDay = t;
}

// ---- Pronunciation scoring (versi awal: kemiripan teks) ----
// Nanti diganti: audio -> Whisper (fine-tuned) -> hasil teks -> fungsi ini.
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
function score(target, heard) {
  const a = norm(target), b = norm(heard);
  if (!a || !b) return 0;
  return Math.round((1 - levenshtein(a, b) / Math.max(a.length, b.length)) * 100);
}

// ---- Routes ----
app.get("/", (_, res) => res.json({ app: "Bhaswara API", ok: true }));
app.get("/lessons/:lang", (req, res) => res.json(LESSONS[req.params.lang] || []));
app.get("/culture", (_, res) => res.json(CULTURE));

app.post("/score", (req, res) => {
  const { username, target, heard } = req.body;
  const s = score(target, heard);
  const u = getUser(username || "tamu");
  const gained = s >= 80 ? 15 : s >= 50 ? 8 : 2;
  u.xp += gained; touchStreak(u);
  res.json({ score: s, xpGained: gained, user: u,
    feedback: s >= 80 ? "Mantap! Pelafalan sudah tepat." : s >= 50 ? "Hampir! Coba ulangi pelan-pelan." : "Dengarkan lagi lalu coba kembali." });
});

app.post("/xp", (req, res) => {
  const { username, amount } = req.body;
  const u = getUser(username || "tamu");
  u.xp += Number(amount) || 0; touchStreak(u);
  res.json(u);
});

app.get("/user/:name", (req, res) => res.json(getUser(req.params.name)));
app.get("/leaderboard", (_, res) =>
  res.json(Object.values(users).sort((a, b) => b.xp - a.xp).slice(0, 20)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Bhaswara API jalan di port " + PORT));