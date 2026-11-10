import React from "react";
import ReactDOM from "react-dom/client";

const stats = [
  { label: "Learners Active", value: "1,284", trend: "+18.2%" },
  { label: "Pronunciation Avg", value: "86/100", trend: "+11.4%" },
  { label: "7-Day Retention", value: "31%", trend: "+4.8%" },
  { label: "Schools Active", value: "12", trend: "+3" },
];

const classes = [
  { name: "Sunda Starter", progress: 82, students: 44, status: "Live" },
  { name: "Culture & Identity", progress: 67, students: 31, status: "Active" },
  { name: "Ritual + Daily Phrases", progress: 91, students: 58, status: "On Track" },
];

const leaderboard = [
  { name: "Nadya", xp: 1340 },
  { name: "Raka", xp: 1220 },
  { name: "Sari", xp: 1188 },
  { name: "Dika", xp: 1024 },
];

const tasks = [
  { title: "Teacher review", detail: "6 students need pronunciation follow-up", color: "#f59e0b" },
  { title: "Culture module", detail: "Sundanese etiquette pack ready for publishing", color: "#22c55e" },
  { title: "AI quality gate", detail: "Model confidence threshold is above target", color: "#3b82f6" },
];

const pulse = [
  { label: "Sunda", value: 78 },
  { label: "Jawa", value: 65 },
  { label: "Bali", value: 52 },
  { label: "Minang", value: 48 },
];

function App() {
  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "linear-gradient(180deg, #fffaf2 0%, #fdf3df 100%)",
        minHeight: "100vh",
        color: "#1f2937",
      }}
    >
      <header
        style={{
          background: "linear-gradient(135deg, #7a3e1d, #b0702d)",
          color: "white",
          padding: "32px 40px 28px",
          boxShadow: "0 20px 50px rgba(122, 62, 29, 0.2)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 }}>
              Bhaswara admin
            </div>
            <h1 style={{ margin: "8px 0 0", fontSize: 38, lineHeight: 1.1 }}>
              Culture Learning Command Center
            </h1>
          </div>
          <button
            style={{
              background: "#f4d77a",
              color: "#3b2b1d",
              border: "none",
              borderRadius: 999,
              padding: "12px 22px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            + New cohort
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {stats.map((item) => (
            <div
              key={item.label}
              style={{
                background: "white",
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 12px 30px rgba(22, 30, 50, 0.06)",
                border: "1px solid rgba(122, 62, 29, 0.08)",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                {item.label}
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 32 }}>{item.value}</strong>
                <span style={{ color: "#1f9d65", fontWeight: 700 }}>{item.trend}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24, marginTop: 28 }}>
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 12px 30px rgba(22, 30, 50, 0.06)",
              border: "1px solid rgba(122, 62, 29, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>Cohort performance</h2>
              <span style={{ color: "#7a3e1d", fontWeight: 700, fontSize: 13 }}>Updated today</span>
            </div>

            {classes.map((item) => (
              <div key={item.name} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong>{item.name}</strong>
                  <span style={{ color: item.status === "Live" ? "#1f9d65" : "#7a3e1d", fontWeight: 700 }}>{item.status}</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${item.progress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #7a3e1d, #e0a526)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
                  {item.students} students • {item.progress}% completion
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 12px 30px rgba(22, 30, 50, 0.06)",
              border: "1px solid rgba(122, 62, 29, 0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 24 }}>Top learners</h2>
            {leaderboard.map((entry, index) => (
              <div
                key={entry.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: index < leaderboard.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "#f7e7c3",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      color: "#7a3e1d",
                    }}
                  >
                    {index + 1}
                  </div>
                  <span style={{ fontWeight: 600 }}>{entry.name}</span>
                </div>
                <strong>{entry.xp} XP</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 28 }}>
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 12px 30px rgba(22, 30, 50, 0.06)",
              border: "1px solid rgba(122, 62, 29, 0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 24 }}>Priority actions</h2>
            {tasks.map((task) => (
              <div
                key={task.title}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "12px 0",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: task.color,
                    marginTop: 6,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{task.title}</div>
                  <div style={{ color: "#6b7280", marginTop: 4 }}>{task.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 12px 30px rgba(22, 30, 50, 0.06)",
              border: "1px solid rgba(122, 62, 29, 0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 24 }}>Language coverage</h2>
            {pulse.map((entry) => (
              <div key={entry.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>{entry.label}</strong>
                  <span style={{ color: "#7a3e1d", fontWeight: 700 }}>{entry.value}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${entry.value}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #c084fc, #f4d77a)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
