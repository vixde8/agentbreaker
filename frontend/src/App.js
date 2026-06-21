import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "./index.css";

const API = "http://127.0.0.1:8000";

// ── Design tokens ──────────────────────────────────────────────────────────
const s = {
  bg:      "#191716",
  surface: "#1E1C1A",
  card:    "#232120",
  border:  "#2E2B28",
  gold:    "#E6AF2E",
  light:   "#E0E2DB",
  warm:    "#BEB7A4",
  muted:   "#6B6760",
  purple:  "#3D348B",
  red:     "#E05252",
  green:   "#52E0A0",
  blue:    "#5278E0",
};

// ── Base components ────────────────────────────────────────────────────────
function Tag({ color = "warm", children }) {
  const map = {
    red:    [s.red,    "rgba(224,82,82,0.12)"],
    green:  [s.green,  "rgba(82,224,160,0.12)"],
    blue:   [s.blue,   "rgba(82,120,224,0.12)"],
    gold:   [s.gold,   "rgba(230,175,46,0.12)"],
    warm:   [s.warm,   "rgba(190,183,164,0.10)"],
    purple: ["#8B7FD4", "rgba(61,52,139,0.20)"],
  };
  const [fg, bg] = map[color];
  return (
    <span style={{
      color: fg, background: bg,
      padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.07em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 8, padding: "12px 10px", textAlign: "center",
    }}>
      <div style={{
        fontSize: 17, fontWeight: 800,
        color: accent || s.light,
        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
      }}>{value}</div>
      <div style={{ fontSize: 10, color: s.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: s.muted,
      textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
    }}>{children}</div>
  );
}

function Input({ type = "text", value, onChange, step }) {
  return (
    <input
      type={type} value={value} onChange={onChange} step={step}
      style={{
        width: "100%", background: s.bg, color: s.light,
        border: `1px solid ${s.border}`, borderRadius: 8,
        padding: "9px 12px", fontSize: 13, outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

// ── Metrics bar ────────────────────────────────────────────────────────────
function MetricsBar() {
  const [m, setM] = useState(null);
  useEffect(() => {
    const go = async () => { const r = await fetch(`${API}/metrics`); setM(await r.json()); };
    go();
    const iv = setInterval(go, 3000);
    return () => clearInterval(iv);
  }, []);
  if (!m) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
      <StatBox label="Total Runs"   value={m.total_runs}                        accent={s.light}  />
      <StatBox label="Trips Fired"  value={m.total_tripped}                     accent={s.red}    />
      <StatBox label="Total Spend"  value={`$${m.total_cost_usd}`}              accent={s.gold}   />
      <StatBox label="Est. Saved"   value={`$${m.estimated_cost_saved_usd}`}    accent={s.green}  />
    </div>
  );
}

// ── Start run form ─────────────────────────────────────────────────────────
function StartRunForm({ onStarted }) {
  const [topic,   setTopic]   = useState("Why is AGI hard to achieve?");
  const [maxIter, setMaxIter] = useState(6);
  const [maxCost, setMaxCost] = useState(2.00);
  const [loading, setLoading] = useState(false);
  const [rules,   setRules]   = useState([]);
  const [selectedRules, setSelectedRules] = useState(
    new Set(["cost_exceeded", "iterations_exceeded", "time_exceeded", "velocity_exceeded", "repeated_tool_calls"])
  );

  useEffect(() => {
    fetch(`${API}/rules`).then(r => r.json()).then(setRules);
  }, []);

  const toggleRule = (id) => {
    setSelectedRules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const go = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/runs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, max_iterations: maxIter, max_cost_usd: maxCost,
          max_time_seconds: 120, max_velocity_per_10s: 0.5,
          rule_ids: Array.from(selectedRules),
        }),
      });
      const d = await r.json();
      onStarted(d.run_id);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: s.light, marginBottom: 14, letterSpacing: "0.02em" }}>New Run</div>

      <div style={{ marginBottom: 10 }}>
        <Label>Topic</Label>
        <Input value={topic} onChange={e => setTopic(e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div>
          <Label>Max Iterations</Label>
          <Input type="number" value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} />
        </div>
        <div>
          <Label>Max Cost $</Label>
          <Input type="number" step="0.1" value={maxCost} onChange={e => setMaxCost(Number(e.target.value))} />
        </div>
      </div>

      <Label>Active Rules</Label>
      <div style={{ marginBottom: 14 }}>
        {rules.map(rule => (
          <label key={rule.id} style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "6px 0", cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={selectedRules.has(rule.id)}
              onChange={() => toggleRule(rule.id)}
              style={{ marginTop: 3, accentColor: s.gold }}
            />
            <div>
              <div style={{ fontSize: 12, color: s.light, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {rule.name}
                {rule.severity === "warn" && <Tag color="warm">warn</Tag>}
              </div>
              <div style={{ fontSize: 10, color: s.muted, lineHeight: 1.4 }}>{rule.description}</div>
            </div>
          </label>
        ))}
      </div>

      <button onClick={go} disabled={loading} style={{
        width: "100%", background: loading ? s.border : s.gold,
        color: loading ? s.warm : s.bg,
        border: "none", borderRadius: 8, padding: "10px 0",
        fontSize: 12, fontWeight: 800, cursor: loading ? "default" : "pointer",
        letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.15s",
      }}>
        {loading ? "Starting…" : "▶  Run Agent"}
      </button>
    </div>
  );
}

// ── Run card ───────────────────────────────────────────────────────────────
function RunCard({ run, isSelected, onClick }) {
  return (
    <div onClick={onClick} className={run.status === "running" ? "live-pulse" : ""} style={{
      background: isSelected ? s.card : s.surface,
      border: `1px solid ${isSelected ? s.gold : s.border}`,
      borderRadius: 10, padding: "13px 14px", cursor: "pointer",
      transition: "border-color 0.15s", marginBottom: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: s.muted }}>{run.run_id}</span>
        {run.status === "tripped"   && <Tag color="red">Tripped</Tag>}
        {run.status === "running"   && <Tag color="blue">Live</Tag>}
        {run.status === "completed" && <Tag color="green">Done</Tag>}
      </div>
      <p style={{ fontSize: 12, color: s.light, marginBottom: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {run.topic}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        {[
          { v: run.iteration_count,               l: "iters"  },
          { v: run.total_tokens.toLocaleString(),  l: "tokens" },
          { v: `$${(run.total_cost_usd ?? 0).toFixed(4)}`, l: "cost" },
        ].map(({ v, l }) => (
          <div key={l} style={{ textAlign: "center", background: s.bg, borderRadius: 6, padding: "4px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.light }}>{v}</div>
            <div style={{ fontSize: 10, color: s.muted }}>{l}</div>
          </div>
        ))}
      </div>
      {run.is_tripped && (
        <div style={{ marginTop: 8, background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.18)", borderRadius: 6, padding: "5px 8px", fontSize: 10, color: s.red }}>
          ⚡ {run.trip_message}
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip ──────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: s.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ color: s.gold, fontWeight: 700 }}>Cost ×0.001: {payload[0]?.value?.toFixed(4)}</div>
    </div>
  );
}

// ── Run detail ─────────────────────────────────────────────────────────────
function RunDetail({ runId }) {
  const [run, setRun] = useState(null);
  useEffect(() => {
      if (!runId) return;
      setRun(null);
      const go = async () => {
        const r = await fetch(`${API}/runs/${runId}`);
        if (!r.ok) return;          // run not found yet — skip this tick
        const data = await r.json();
        if (data && data.run_id) setRun(data);
      };
      go();
      const iv = setInterval(go, 1000);
      return () => clearInterval(iv);
    }, [runId]);

  if (!runId) return (
    <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>⚡</div>
        <div style={{ color: s.muted, fontSize: 12 }}>Select a run to inspect</div>
      </div>
    </div>
  );

  if (!run) return (
    <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
      <div style={{ color: s.muted, fontSize: 12 }}>Loading…</div>
    </div>
  );

  const chartData = (run.iterations || []).map(it => ({
    name: `#${it.iteration}`,
    cost: parseFloat((it.cost * 1000).toFixed(4)),
  }));

  return (
    <div className={`fade-in ${run.is_tripped ? "trip-flash" : ""}`} style={{
      background: s.surface,
      border: `1px solid ${run.is_tripped ? "rgba(224,82,82,0.30)" : s.border}`,
      borderRadius: 12, padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: s.muted }}>{run.run_id}</span>
            {run.status === "tripped"   && <Tag color="red">Tripped</Tag>}
            {run.status === "running"   && <Tag color="blue">Live</Tag>}
            {run.status === "completed" && <Tag color="green">Completed</Tag>}
          </div>
          <p style={{ color: s.light, fontWeight: 600, fontSize: 14, maxWidth: 420 }}>{run.topic}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: s.gold, fontVariantNumeric: "tabular-nums" }}>
            ${(run.total_cost_usd ?? 0).toFixed(4)}
          </div>
          <div style={{ fontSize: 10, color: s.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>total cost</div>
        </div>
      </div>

      {/* Trip alert */}
      {run.is_tripped && (
        <div style={{ background: "rgba(224,82,82,0.07)", border: "1px solid rgba(224,82,82,0.22)", borderRadius: 10, padding: "13px 16px", marginBottom: 20 }}>
          <div style={{ color: s.red, fontWeight: 800, fontSize: 12, marginBottom: 3 }}>🔴 Circuit Breaker Tripped</div>
          <div style={{ color: "#E8A0A0", fontSize: 12 }}>{run.trip_message}</div>
          <div style={{ color: s.muted, fontSize: 10, marginTop: 5 }}>
            Estimated savings: ${(run.total_cost_usd * 2).toFixed(4)} based on 2× projected overage
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 22 }}>
        <StatBox label="Iterations"    value={run.iteration_count} />
        <StatBox label="Total Tokens"  value={run.total_tokens.toLocaleString()} />
        <StatBox label="Input Tokens"  value={run.total_input_tokens.toLocaleString()} />
        <StatBox label="Output Tokens" value={run.total_output_tokens.toLocaleString()} />
        <StatBox label="Elapsed"       value={`${run.elapsed_seconds}s`} />
        <StatBox label="Tool Calls"    value={run.tool_calls?.length || 0} />
        <StatBox label="Max Iters"     value={run.config?.max_iterations} />
        <StatBox label="Max Cost"      value={`$${run.config?.max_cost_usd}`} />
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <>
          <Label>Cost trajectory (×0.001 USD per iteration)</Label>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={s.gold} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={s.gold} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={s.border} vertical={false} />
              <XAxis dataKey="name" stroke={s.border} tick={{ fontSize: 11, fill: s.muted }} axisLine={false} tickLine={false} />
              <YAxis stroke={s.border} tick={{ fontSize: 11, fill: s.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="cost" stroke={s.gold} strokeWidth={2} fill="url(#g)"
                dot={{ fill: s.gold, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: s.gold }} />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [runs,     setRuns]     = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchRuns = useCallback(async () => {
    const r = await fetch(`${API}/runs`);
    setRuns(await r.json());
  }, []);

  useEffect(() => {
    fetchRuns();
    const iv = setInterval(fetchRuns, 2000);
    return () => clearInterval(iv);
  }, [fetchRuns]);

  const handleStarted = id => { setSelected(id); setTimeout(fetchRuns, 500); };
  const handleClear   = async () => { await fetch(`${API}/runs`, { method: "DELETE" }); setRuns([]); setSelected(null); };

  return (
    <div style={{ minHeight: "100vh", background: s.bg, padding: "24px 28px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: s.gold, letterSpacing: "-0.02em" }}>
              ⚡ AgentBreaker
            </span>
            <Tag color="gold">Beta</Tag>
          </div>
          <p style={{ color: s.muted, fontSize: 11 }}>Real-time circuit breaker for AI agent loops</p>
        </div>
        <button onClick={handleClear} style={{
          background: "transparent", border: `1px solid ${s.border}`,
          color: s.muted, borderRadius: 8, padding: "7px 14px",
          fontSize: 11, cursor: "pointer", letterSpacing: "0.04em",
          textTransform: "uppercase", fontFamily: "inherit",
        }}>
          Clear Runs
        </button>
      </div>

      {/* Metrics */}
      <MetricsBar />

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 14, alignItems: "start" }}>

        {/* Left column */}
        <div>
          <StartRunForm onStarted={handleStarted} />
          <div style={{ fontSize: 10, fontWeight: 700, color: s.muted, textTransform: "uppercase", letterSpacing: "0.07em", margin: "18px 0 10px" }}>
            Run History
          </div>
          {runs.length === 0 && (
            <p style={{ color: s.border, fontSize: 12 }}>No runs yet.</p>
          )}
          <div style={{ maxHeight: "62vh", overflowY: "auto", paddingRight: 2 }}>
            {runs.map(r => (
              <RunCard key={r.run_id} run={r}
                isSelected={selected === r.run_id}
                onClick={() => setSelected(r.run_id)} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <RunDetail runId={selected} />
      </div>
    </div>
  );
}