import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";

const API =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : Platform.OS === "ios"
      ? "http://127.0.0.1:3000"
      : "http://localhost:3000");
const USER = "adnan";
const C = {
  brown: "#7A3E1D",
  gold: "#E0A526",
  cream: "#FFF6E5",
  green: "#2E7D32",
  red: "#C62828",
};

const request = async (path, options = {}) => {
  const response = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
};

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export default function App() {
  const [tab, setTab] = useState("belajar");
  const [me, setMe] = useState({ xp: 0, streak: 0 });

  const refresh = async () => {
    try {
      const nextUser = await get(`/user/${USER}`);
      setMe({ xp: Number(nextUser?.xp ?? 0), streak: Number(nextUser?.streak ?? 0) });
    } catch {
      setMe({ xp: 0, streak: 0 });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.logo}>Bhaswara</Text>
        <Text style={s.stats}>
          Streak {me.streak} | {me.xp} XP
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === "belajar" && <Learn onDone={refresh} />}
        {tab === "budaya" && <Culture />}
        {tab === "peringkat" && <Board />}
      </View>
      <View style={s.tabs}>
        {[
          ["belajar", "Belajar"],
          ["budaya", "Budaya"],
          ["peringkat", "Peringkat"],
        ].map(([k, l]) => (
          <TouchableOpacity key={k} style={s.tab} onPress={() => setTab(k)}>
            <Text style={[s.tabText, tab === k && { color: C.gold }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Learn({ onDone }) {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("kartu");
  const [picked, setPicked] = useState(null);
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLessons = async () => {
      try {
        setIsLoading(true);
        setErr("");
        const response = await get("/lessons/sunda");
        if (!isMounted) return;
        setItems(Array.isArray(response) ? response : []);
      } catch {
        if (isMounted) {
          setErr("Backend tidak terhubung. Cek IP & server.");
          setItems([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadLessons();

    return () => {
      isMounted = false;
    };
  }, []);

  if (err) return <Text style={s.err}>{err}</Text>;
  if (isLoading) return <Text style={s.err}>Memuat materi...</Text>;
  if (!items.length) return <Text style={s.err}>Belum ada materi. Coba lagi nanti.</Text>;

  const cur = items[index % items.length];
  const wrong = items.filter((item) => item.id !== cur.id).map((item) => item.meaning);
  const uniqueWrong = [...new Set(wrong)];
  const optionPool = uniqueWrong.length >= 3 ? uniqueWrong : [...new Set([cur.meaning, ...uniqueWrong])];
  const finalOptions = useMemo(() => {
    const options = [...new Set(optionPool)];
    while (options.length < 4) {
      options.push(cur.meaning);
    }

    const filtered = options.filter((option) => option !== cur.meaning);
    const final = [...new Set([...filtered.slice(0, 3), cur.meaning])];
    return final.sort(() => Math.random() - 0.5);
  }, [optionPool, cur.meaning]);

  const next = () => {
    setIndex((previous) => previous + 1);
    setMode("kartu");
    setPicked(null);
    setHeard("");
    setResult(null);
    setErr("");
  };

  const answer = async (option) => {
    if (picked || isSubmitting) return;

    setPicked(option);
    setErr("");
    if (option !== cur.meaning) return;

    setIsSubmitting(true);
    try {
      await post("/xp", { username: USER, amount: 10 });
      await onDone();
    } catch {
      setErr("Gagal menambahkan XP. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSpeech = async () => {
    if (isSubmitting || !heard.trim()) {
      if (!heard.trim()) setErr("Ketik pelafalanmu dulu sebelum menilai.");
      return;
    }

    setIsSubmitting(true);
    setErr("");
    try {
      const response = await post("/score", { username: USER, target: cur.word, heard });
      setResult(response);
      await onDone();
    } catch {
      setErr("Skor gagal diproses. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={s.small}>
        Bahasa Sunda | Kata {(index % items.length) + 1}/{items.length}
      </Text>
      <View style={s.card}>
        <Text style={s.word}>{cur.word}</Text>
        {mode !== "kuis" && <Text style={s.meaning}>{cur.meaning}</Text>}
      </View>

      <View style={s.row}>
        {["kartu", "kuis", "ucap"].map((m) => (
          <TouchableOpacity
            key={m}
            style={[s.pill, mode === m && s.pillOn]}
            onPress={() => setMode(m)}
          >
            <Text style={{ color: mode === m ? "#fff" : C.brown }}>
              {m === "kartu" ? "Kartu" : m === "kuis" ? "Kuis" : "Ucapkan"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "kuis" &&
        finalOptions.map((option) => (
          <TouchableOpacity
            key={`${cur.id}-${option}`}
            style={[
              s.opt,
              picked && option === cur.meaning && { backgroundColor: "#C8E6C9" },
              picked === option && option !== cur.meaning && { backgroundColor: "#FFCDD2" },
            ]}
            disabled={!!picked || isSubmitting}
            onPress={() => answer(option)}
          >
            <Text style={s.optText}>{option}</Text>
          </TouchableOpacity>
        ))}

      {mode === "ucap" && (
        <View>
          <Text style={s.small}>
            Versi awal: ketik apa yang kamu ucapkan (nanti diganti rekaman suara + Whisper).
          </Text>
          <TextInput
            style={s.input}
            value={heard}
            onChangeText={setHeard}
            placeholder="Ketik pelafalanmu..."
          />
          <TouchableOpacity style={s.btn} onPress={submitSpeech} disabled={isSubmitting}>
            <Text style={s.btnText}>Nilai Pelafalan</Text>
          </TouchableOpacity>
          {result && (
            <Text style={[s.result, { color: result.score >= 80 ? C.green : C.red }]}>
              Skor {result.score}/100 (+{result.xpGained} XP)
              {"\n"}
              {result.feedback}
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity style={[s.btn, { backgroundColor: C.gold }]} onPress={next}>
        <Text style={s.btnText}>{`Kata berikutnya >`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Culture() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const loadCulture = async () => {
      try {
        setData(await get("/culture"));
      } catch {
        setData([]);
      }
    };

    loadCulture();
  }, []);

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.title}
      contentContainerStyle={{ padding: 20 }}
      renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.word}>{item.title}</Text>
          <Text style={s.meaning}>{item.fact}</Text>
        </View>
      )}
    />
  );
}

function Board() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const loadBoard = async () => {
      try {
        const result = await get("/leaderboard");
        setData(Array.isArray(result) ? result : []);
      } catch {
        setData([]);
      }
    };

    loadBoard();
  }, []);

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => `${item.name}-${item.xp}`}
      contentContainerStyle={{ padding: 20 }}
      ListEmptyComponent={<Text style={s.err}>Belum ada data. Mulai belajar dulu!</Text>}
      renderItem={({ item, index }) => (
        <View style={s.rowCard}>
          <Text style={s.rank}>#{index + 1}</Text>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.xp}>{item.xp} XP</Text>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  header: {
    backgroundColor: C.brown,
    padding: 16,
    paddingTop: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800" },
  stats: { color: C.gold, fontWeight: "700" },
  tabs: { flexDirection: "row", backgroundColor: C.brown },
  tab: { flex: 1, padding: 14, alignItems: "center" },
  tabText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: C.gold,
  },
  word: { fontSize: 28, fontWeight: "800", color: C.brown },
  meaning: { fontSize: 18, marginTop: 8, color: "#444" },
  small: { color: "#777", marginVertical: 6 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.brown,
  },
  pillOn: { backgroundColor: C.brown },
  opt: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  optText: { fontSize: 16 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ccc",
    marginVertical: 10,
  },
  btn: {
    backgroundColor: C.brown,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  result: { marginTop: 12, fontSize: 16, fontWeight: "700" },
  err: { padding: 24, textAlign: "center", color: C.red },
  rowCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  rank: { width: 44, fontWeight: "800", color: C.gold, fontSize: 18 },
  name: { flex: 1, fontSize: 16 },
  xp: { fontWeight: "700", color: C.brown },
});
