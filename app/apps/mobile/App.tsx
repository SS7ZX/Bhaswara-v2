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

type SessionUser = { username: string; role: string };
type AuthResponse = {
  session: { accessToken: string; refreshToken: string };
  user: SessionUser;
};

const configuredApiUrl =
  typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : undefined;
const isDevelopmentBuild = typeof __DEV__ === "boolean" && __DEV__;
const API =
  configuredApiUrl ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : Platform.OS === "ios"
      ? "http://127.0.0.1:3000"
      : "http://localhost:3000");
if (!isDevelopmentBuild && (!configuredApiUrl || !configuredApiUrl.startsWith("https://"))) {
  throw new Error("Set EXPO_PUBLIC_API_URL to the production HTTPS API endpoint.");
}
const C = { brown: "#7A3E1D", gold: "#E0A526", cream: "#FFF6E5", green: "#2E7D32", red: "#C62828" };
const secureAccessTokenKey = "bhaswara.accessToken";
const secureRefreshTokenKey = "bhaswara.refreshToken";
let apiAccessToken: string | null = null;
let apiRefreshToken: string | null = null;
let refreshSession: () => Promise<void>;

type LessonItem = {
  id: string;
  word: string;
  meaning: string;
};

type LeaderboardEntry = {
  name: string;
  xp: number;
};

const request = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (apiAccessToken) {
    headers.set("Authorization", `Bearer ${apiAccessToken}`);
  }

  let response = await fetch(API + path, {
    ...options,
    headers,
  });

  if (response.status === 401 && apiRefreshToken && path !== "/auth/refresh") {
    try {
      await refreshSession();
      headers.set("Authorization", `Bearer ${apiAccessToken}`);
      response = await fetch(API + path, { ...options, headers });
    } catch {
      apiAccessToken = null;
      apiRefreshToken = null;
      try {
        await clearStoredToken();
      } catch {
        throw new Error("401: Sesi berakhir dan token lokal tidak dapat dibersihkan.");
      }
      throw new Error("401: Sesi berakhir. Silakan masuk kembali.");
    }
  }

  if (response.status === 204) return null;

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`${response.status}: ${body?.error?.message ?? response.statusText}`);
  }

  return response.json();
};

const get = (path: string) => request(path);
const post = (path: string, body: unknown) =>
  request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

const readStoredToken = async (key: string) => {
  if (Platform.OS === "web") return null;
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
};

const saveStoredTokens = async (accessToken: string, refreshToken: string) => {
  if (Platform.OS === "web") return;
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(secureAccessTokenKey, accessToken);
  try {
    await SecureStore.setItemAsync(secureRefreshTokenKey, refreshToken);
  } catch (error) {
    await SecureStore.deleteItemAsync(secureAccessTokenKey);
    throw error;
  }
};

const clearStoredToken = async () => {
  if (Platform.OS === "web") return;
  const SecureStore = await import("expo-secure-store");
  await Promise.all([
    SecureStore.deleteItemAsync(secureAccessTokenKey),
    SecureStore.deleteItemAsync(secureRefreshTokenKey),
  ]);
};

refreshSession = async () => {
  if (!apiRefreshToken) throw new Error("Refresh token tidak tersedia.");
  const response = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: apiRefreshToken }),
  });
  if (!response.ok) {
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  const payload = (await response.json()) as AuthResponse;
  apiAccessToken = payload.session.accessToken;
  apiRefreshToken = payload.session.refreshToken;
  await saveStoredTokens(apiAccessToken, apiRefreshToken);
};

export default function App() {
  const [tab, setTab] = useState("belajar");
  const [me, setMe] = useState({ xp: 0, streak: 0 });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          readStoredToken(secureAccessTokenKey),
          readStoredToken(secureRefreshTokenKey),
        ]);
        if (accessToken && refreshToken) {
          apiAccessToken = accessToken;
          apiRefreshToken = refreshToken;
          const response = await get("/auth/session");
          if (active) setUser(response.user as SessionUser);
        } else {
          apiAccessToken = null;
          apiRefreshToken = null;
        }
      } catch {
        apiAccessToken = null;
        apiRefreshToken = null;
        try {
          await clearStoredToken();
        } catch {
          if (active) setSessionError("Sesi gagal dibersihkan. Tutup lalu buka kembali aplikasi.");
        }
        if (active && !sessionError) setSessionError("Sesi berakhir. Silakan masuk kembali.");
      } finally {
        if (active) setIsCheckingSession(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    try {
      const response = await get("/user/me");
      setMe({ xp: Number(response?.xp ?? 0), streak: Number(response?.streak ?? 0) });
    } catch (error) {
      setMe({ xp: 0, streak: 0 });
      if (error instanceof Error && error.message.startsWith("401:")) {
        apiAccessToken = null;
        setUser(null);
        await clearStoredToken();
        setSessionError("Sesi berakhir. Silakan masuk kembali.");
      }
    }
  };

  useEffect(() => {
    if (user) void refresh();
  }, [user]);

  const handleAuthenticated = async (response: AuthResponse) => {
    if (!response.session?.accessToken || !response.session?.refreshToken) {
      throw new Error("Server mengembalikan sesi yang tidak valid.");
    }
    apiAccessToken = response.session.accessToken;
    apiRefreshToken = response.session.refreshToken;
    try {
      await saveStoredTokens(response.session.accessToken, response.session.refreshToken);
      setSessionError("");
      setUser(response.user);
    } catch {
      apiAccessToken = null;
      apiRefreshToken = null;
      setSessionError("Token tidak dapat disimpan dengan aman di perangkat ini.");
      throw new Error("Penyimpanan sesi gagal.");
    }
  };

  const logout = async () => {
    let logoutFailed = false;
    try {
      await post("/auth/logout", {});
    } catch {
      logoutFailed = true;
    } finally {
      apiAccessToken = null;
      apiRefreshToken = null;
      await clearStoredToken();
      setUser(null);
      setMe({ xp: 0, streak: 0 });
    }
    if (logoutFailed) {
      setSessionError("Sesi lokal dihapus, tetapi server tidak dapat mengonfirmasi logout.");
    }
  };

  if (isCheckingSession) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.err}>Memeriksa sesi...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} initialError={sessionError} />;
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.logo}>Bhaswara</Text>
        <Text style={s.stats}>
          {user.username} | Streak {me.streak} | {me.xp} XP
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
        ].map(([key, label]) => (
          <TouchableOpacity key={key} style={s.tab} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && { color: C.gold }]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.tab} onPress={() => void logout()}>
          <Text style={s.tabText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({
  onAuthenticated,
  initialError,
}: {
  onAuthenticated: (response: AuthResponse) => Promise<void>;
  initialError: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload =
        mode === "register" ? { username, email, password } : { username, password };
      await onAuthenticated((await post(endpoint, payload)) as AuthResponse);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Autentikasi gagal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.authCard}>
        <Text style={s.logo}>Bhaswara</Text>
        <Text style={s.authTitle}>{mode === "login" ? "Masuk" : "Buat akun"}</Text>
        <TextInput
          style={s.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Username"
          accessibilityLabel="Username"
        />
        {mode === "register" && (
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            accessibilityLabel="Email"
          />
        )}
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={mode === "register" ? "Password (minimal 12 karakter)" : "Password"}
          accessibilityLabel="Password"
        />
        {error ? <Text style={s.err}>{error}</Text> : null}
        <TouchableOpacity style={s.btn} onPress={() => void submit()} disabled={isSubmitting}>
          <Text style={s.btnText}>
            {isSubmitting ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.authToggle}
          onPress={() => {
            setMode((current) => (current === "login" ? "register" : "login"));
            setError("");
          }}
        >
          <Text style={s.authToggleText}>
            {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Learn({ onDone }: { onDone: () => Promise<void> }) {
  const [items, setItems] = useState<LessonItem[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("kartu");
  const [picked, setPicked] = useState<string | null>(null);
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
        setItems(Array.isArray(response) ? (response as LessonItem[]) : []);
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
    setErr("");
  };

  const answer = async (option: string) => {
    if (picked || isSubmitting) return;

    setPicked(option);
    setErr("");
    if (option !== cur.meaning) return;

    setIsSubmitting(true);
    try {
      const result = await post("/xp", { lessonId: cur.id, answer: option });
      if (!result.isCorrect) {
        setErr("Jawaban belum tepat. Coba lagi.");
        setPicked(null);
        return;
      }
      await onDone();
    } catch {
      setErr("Jawaban gagal disimpan. Coba lagi.");
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
            disabled={Boolean(picked) || isSubmitting}
            onPress={() => answer(option)}
          >
            <Text style={s.optText}>{option}</Text>
          </TouchableOpacity>
        ))}

      {mode === "ucap" && (
        <View style={s.card}>
          <Text style={s.small}>
            Penilaian pelafalan belum tersedia. Versi saat ini belum merekam atau
            mengenali suara; kami menonaktifkannya agar teks tiruan tidak ditampilkan
            sebagai hasil AI.
          </Text>
        </View>
      )}

      <TouchableOpacity style={[s.btn, { backgroundColor: C.gold }]} onPress={next}>
        <Text style={s.btnText}>{`Kata berikutnya >`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Culture() {
  const [data, setData] = useState<Array<{ title: string; fact: string }>>([]);

  useEffect(() => {
    const loadCulture = async () => {
      try {
        const response = await get("/culture");
        setData(
          Array.isArray(response) ? (response as Array<{ title: string; fact: string }>) : [],
        );
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
      renderItem={({ item }: { item: { title: string; fact: string } }) => (
        <View style={s.card}>
          <Text style={s.word}>{item.title}</Text>
          <Text style={s.meaning}>{item.fact}</Text>
        </View>
      )}
    />
  );
}

function Board() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const loadBoard = async () => {
      try {
        const response = await get("/leaderboard");
        setData(Array.isArray(response) ? (response as LeaderboardEntry[]) : []);
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
      renderItem={({ item, index }: { item: LeaderboardEntry; index: number }) => (
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
  authCard: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  authTitle: { color: C.brown, fontSize: 24, fontWeight: "800", marginTop: 24 },
  authToggle: { alignItems: "center", padding: 14, marginTop: 8 },
  authToggleText: { color: C.brown, fontWeight: "600" },
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
