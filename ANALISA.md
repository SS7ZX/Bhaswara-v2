# ANALISA MENDALAM - BHASWARA

## 1. Ringkasan
Bhaswara = app belajar bahasa daerah dengan AI penilai pelafalan + gamifikasi + konten budaya.
Fase 1 (MVP): 1 bahasa (Sunda), 10 kosakata, XP, streak, leaderboard, konten budaya.

## 2. Kekuatan
- Niche jelas dan selaras dengan program RBDN dan Budaya GO 2025.
- Diferensiasi budaya (avatar baju adat, motif batik, lagu daerah).
- Target awal realistis (1.000 user, 10 sekolah mitra).

## 3. Masalah di proposal dan perbaikannya
1. "Speech-to-Speech Translation" salah istilah. Yang dibutuhkan: ASR + pronunciation scoring. Ganti istilah.
2. Whisper lemah untuk bahasa daerah (Bugis, Minang, Bali hampir tidak didukung). Fine-tune dengan dataset sendiri, mulai 1-2 bahasa.
3. TensorFlow + Whisper + HuggingFace: campur framework. Pakai PyTorch saja.
4. Klaim "platform pertama di Indonesia" berisiko. Cek kompetitor lokal, ubah jadi klaim yang lebih spesifik.
5. Target retensi D7 70% tidak realistis (kisaran wajar 15-30%). Turunkan ke 25-30%.
6. "20% pengguna meningkat pelafalannya" belum terukur. Definisikan: skor awal vs skor setelah 4 minggu.
7. Verifikasi statistik ke sumber asli: 718 bahasa, 120 revitalisasi, 74% pengguna app edukasi.
8. Timeline kosong, ada typo ("kemitraa8n", ".." di akhir kalimat).
9. Etika dan data: consent penutur asli, hak dataset, UU PDP untuk pengguna anak, moderasi leaderboard.
10. Dialek: tetapkan dialek baku per bahasa untuk fase 1.
11. Model bisnis: tambah jalur B2B/B2G (lisensi sekolah, dashboard guru, kerja sama pemda).

## 4. Risiko utama
- Data suara bahasa daerah (low-resource) = bottleneck terbesar.
- Latensi dan biaya inference.
- Kurasi konten budaya butuh narasumber, bukan hanya developer.

## 5. Arsitektur
- Mobile: React Native (Expo)
- Backend: Node.js + Express (sekarang in-memory; target PostgreSQL + Redis untuk ranking)
- AI service: Python + PyTorch, Whisper fine-tuned, scoring berbasis fonem
- Admin guru: dashboard web

## 6. Roadmap 8 minggu
- Minggu 1-2: desain UI, Sunda, 30-50 kosakata
- Minggu 3-4: lesson, kuis, XP/streak, auth
- Minggu 5-6: pronunciation scoring (rekaman audio + Whisper)
- Minggu 7: leaderboard, avatar baju adat, konten budaya
- Minggu 8: uji coba 1-2 sekolah, polish, video demo

## 7. KPI yang dapat diukur
- D1/D7 retention, rata-rata sesi per minggu, % user dengan streak 7 hari
- Skor pelafalan rata-rata minggu 1 vs minggu 4
- Jumlah kata dikuasai per user, jumlah sekolah aktif