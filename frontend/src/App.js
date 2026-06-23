import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Zap, 
  Play, 
  Cpu, 
  Coins, 
  Clock, 
  Activity, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  ChevronRight, 
  CornerDownRight,
  Database,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  GitBranch,
  GitCompare
} from "lucide-react";
import "./index.css";

const API = "http://127.0.0.1:8000";

// ── Design tokens ──────────────────────────────────────────────────────────
const s = {
  bg: "#0b0f19",
  surface: "rgba(17, 24, 39, 0.55)",
  card: "rgba(31, 41, 55, 0.35)",
  border: "rgba(255, 255, 255, 0.06)",
  borderHover: "rgba(255, 255, 255, 0.12)",
  teal: "#14B8A6",
  tealGlow: "rgba(20, 184, 166, 0.12)",
  mint: "#10B981",
  mintGlow: "rgba(16, 185, 129, 0.12)",
  light: "#F9FAFB",
  muted: "#9CA3AF",
  dark: "#0b0f19",
  red: "#F87171",
  redGlow: "rgba(248, 113, 113, 0.12)",
  green: "#34D399",
  greenGlow: "rgba(52, 211, 153, 0.12)",
  blue: "#0ea5e9",
  blueGlow: "rgba(14, 165, 233, 0.12)",
  purple: "#8B5CF6",
  purpleGlow: "rgba(139, 92, 246, 0.12)",
};

// ── Base components ────────────────────────────────────────────────────────
function Tag({ color = "warm", children }) {
  const map = {
    red:    [s.red,    "rgba(248, 113, 113, 0.12)"],
    green:  [s.green,  "rgba(52, 211, 153, 0.12)"],
    blue:   [s.blue,   "rgba(14, 165, 233, 0.12)"],
    teal:   [s.teal,   "rgba(20, 184, 166, 0.12)"],
    warm:   [s.muted,  "rgba(156, 163, 175, 0.10)"],
    purple: [s.purple, "rgba(139, 92, 246, 0.12)"],
  };
  const [fg, bg] = map[color] || map.warm;
  return (
    <span style={{
      color: fg,
      background: bg,
      border: `1px solid ${fg}20`,
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: fg }} />
      {children}
    </span>
  );
}

function StatBox({ label, value, accent, icon: Icon, glow }) {
  return (
    <div style={{
      background: "rgba(17, 24, 39, 0.4)",
      border: `1px solid ${s.border}`,
      borderRadius: 12,
      padding: "16px 14px",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "all 0.2s",
      boxShadow: glow ? `0 0 20px ${glow}10` : "none",
    }}>
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 36,
        height: 36,
        background: `radial-gradient(circle at 100% 0%, ${accent || s.light}0a, transparent 70%)`,
      }} />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: s.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ color: accent || s.muted, opacity: 0.8 }} />}
      </div>
      
      <div className="tabular-numbers" style={{
        fontSize: 20,
        fontWeight: 800,
        color: accent || s.light,
        letterSpacing: "-0.02em",
      }}>
        {value}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: s.muted,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: 6,
      display: "flex",
      alignItems: "center",
      gap: 4
    }}>{children}</div>
  );
}

function Input({ type = "text", value, onChange, onBlur, step, icon: Icon }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {Icon && (
        <Icon size={14} style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: s.muted,
          opacity: 0.8
        }} />
      )}
      <input
        type={type} 
        value={value} 
        onChange={onChange} 
        step={step}
        style={{
          width: "100%",
          background: "rgba(10, 15, 26, 0.6)",
          color: s.light,
          border: `1px solid ${s.border}`,
          borderRadius: 8,
          padding: `9px 12px 9px ${Icon ? "32px" : "12px"}`,
          fontSize: 13,
          outline: "none",
          fontFamily: "inherit",
          transition: "all 0.2s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = s.teal;
          e.target.style.boxShadow = `0 0 10px ${s.tealGlow}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = s.border;
          e.target.style.boxShadow = "none";
          if (onBlur) onBlur(e);
        }}
      />
    </div>
  );
}

// ── Metrics bar ────────────────────────────────────────────────────────────
function MetricsBar() {
  const [m, setM] = useState(null);
  useEffect(() => {
    const go = async () => { 
      try {
        const r = await fetch(`${API}/metrics`); 
        setM(await r.json()); 
      } catch (e) {
        console.error("API error", e);
      }
    };
    go();
    const iv = setInterval(go, 3000);
    return () => clearInterval(iv);
  }, []);

  if (!m) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-panel" style={{ height: 74, borderRadius: 12, opacity: 0.5 }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
      <StatBox label="Total Runs"   value={m.total_runs}                     accent={s.mint}   icon={Activity}     glow={s.mint} />
      <StatBox label="Trips Fired"  value={m.total_tripped}                  accent={s.red}    icon={AlertTriangle} glow={s.red} />
      <StatBox label="Total Spend"  value={`$${(m.total_cost_usd ?? 0).toFixed(4)}`} accent={s.teal}   icon={Coins}        glow={s.teal} />
      <StatBox label="Est. Saved"   value={`$${(m.estimated_cost_saved_usd ?? 0).toFixed(4)}`} accent={s.green} icon={CheckCircle2} glow={s.green} />
    </div>
  );
}

// ── Start run form ─────────────────────────────────────────────────────────
function StartRunForm({ onStarted }) {
  const [topic,   setTopic]   = useState("Why is AGI hard to achieve?");
  const [maxIter, setMaxIter] = useState(6);
  const [maxCostInput, setMaxCostInput] = useState("2.00");
  const [maxCost, setMaxCost] = useState(2.00);
  const [loading, setLoading] = useState(false);
  const [rules,   setRules]   = useState([]);
  const [selectedRules, setSelectedRules] = useState(
    new Set(["cost_exceeded", "iterations_exceeded", "time_exceeded", "velocity_exceeded", "repeated_tool_calls"])
  );

  useEffect(() => {
    fetch(`${API}/rules`).then(r => r.json()).then(setRules).catch(console.error);
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
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  return (
    <div className="glass-panel" style={{ borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Sliders size={16} style={{ color: s.teal }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: s.light, letterSpacing: "0.02em" }}>Configure Run Policy</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label><Search size={10} /> Topic</Label>
        <Input value={topic} onChange={e => setTopic(e.target.value)} icon={Sparkles} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <Label><Activity size={10} /> Max Iterations</Label>
          <Input type="number" value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} />
        </div>
        <div>
          <Label><Coins size={10} /> Max Cost ($)</Label>
          <Input 
            type="text" 
            value={maxCostInput} 
            onChange={e => setMaxCostInput(e.target.value)} 
            onBlur={() => setMaxCost(parseFloat(maxCostInput) || 0)} 
          />
        </div>
      </div>

      <Label><FileText size={10} /> Active Guardrails</Label>
      <div style={{ 
        marginBottom: 16, 
        maxHeight: 180, 
        overflowY: "auto", 
        paddingRight: 4, 
        border: `1px solid ${s.border}`, 
        borderRadius: 8, 
        background: "rgba(10, 15, 26, 0.4)",
        padding: "4px 8px"
      }}>
        {rules.map(rule => (
          <label key={rule.id} className="custom-checkbox-wrapper" style={{
            display: "flex", 
            alignItems: "flex-start", 
            gap: 10,
            padding: "8px 0", 
            cursor: "pointer",
            borderBottom: rule.id !== rules[rules.length-1].id ? `1px solid ${s.border}` : "none"
          }}>
            <input
              type="checkbox"
              checked={selectedRules.has(rule.id)}
              onChange={() => toggleRule(rule.id)}
            />
            <div className="custom-switch-slider" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ marginLeft: 2 }}>
              <div style={{ fontSize: 11, color: s.light, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {rule.name}
                {rule.severity === "warn" ? (
                  <Tag color="teal">Warning Only</Tag>
                ) : (
                  <Tag color="red">STOP</Tag>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: s.muted, lineHeight: 1.3, marginTop: 2 }}>{rule.description}</div>
            </div>
          </label>
        ))}
      </div>

      <button onClick={go} disabled={loading} style={{
        width: "100%", 
        background: loading ? "rgba(31, 41, 55, 0.8)" : `linear-gradient(135deg, ${s.teal}, ${s.green})`,
        color: s.light,
        border: "none", 
        borderRadius: 8, 
        padding: "11px 0",
        fontSize: 12, 
        fontWeight: 800, 
        cursor: loading ? "default" : "pointer",
        letterSpacing: "0.06em", 
        textTransform: "uppercase", 
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: loading ? "none" : `0 4px 14px ${s.tealGlow}`,
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = `0 6px 18px rgba(20, 184, 166, 0.3)`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = loading ? "none" : `0 4px 14px ${s.tealGlow}`;
      }}>
        {loading ? (
          <>
            <RefreshCw size={14} className="heartbeat-dot" />
            <span>Spawning Agent...</span>
          </>
        ) : (
          <>
            <Play size={12} fill="currentColor" />
            <span>Execute Run Policy</span>
          </>
        )}
      </button>
    </div>
  );
}

// ── Run card ───────────────────────────────────────────────────────────────
function RunCard({ run, isSelected, onClick }) {
  const isRunning = run.status === "running";
  const isTripped = run.status === "tripped";
  
  return (
    <div 
      onClick={onClick} 
      className={isRunning ? "live-pulse" : ""} 
      style={{
        background: isSelected ? "rgba(20, 184, 166, 0.08)" : "rgba(17, 24, 39, 0.45)",
        border: `1px solid ${isSelected ? s.teal : isRunning ? s.teal : s.border}`,
        borderRadius: 10, 
        padding: "14px", 
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", 
        marginBottom: 8,
        boxShadow: isSelected ? `0 4px 12px rgba(20, 184, 166, 0.08)` : "none",
        position: "relative"
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isRunning) {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
          e.currentTarget.style.transform = "translateX(2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isRunning) {
          e.currentTarget.style.borderColor = s.border;
          e.currentTarget.style.transform = "none";
        }
      }}>
      
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="tabular-numbers" style={{ 
          fontFamily: "var(--font-mono)", 
          fontSize: 10.5, 
          color: isSelected ? s.teal : s.muted,
          fontWeight: 600
        }}>
          {run.run_id}
        </span>
        {isTripped && <Tag color="red">Tripped</Tag>}
        {isRunning && <Tag color="teal">Live</Tag>}
        {run.status === "completed" && <Tag color="green">Done</Tag>}
      </div>

      {/* Topic */}
      <p style={{ 
        fontSize: 12.5, 
        color: s.light, 
        marginBottom: 12, 
        fontWeight: 500,
        overflow: "hidden", 
        textOverflow: "ellipsis", 
        whiteSpace: "nowrap" 
      }}>
        {run.topic}
      </p>

      {/* Metrics subgrid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 6 }}>
        {[
          { v: run.iteration_count,               l: "iters",  icon: Activity },
          { v: run.total_tokens.toLocaleString(),  l: "tokens", icon: Cpu },
          { v: `$${(run.total_cost_usd ?? 0).toFixed(4)}`, l: "cost", icon: Coins },
        ].map(({ v, l, icon: Icon }) => (
          <div key={l} style={{ 
            textAlign: "center", 
            background: "rgba(10, 15, 26, 0.4)", 
            borderRadius: 6, 
            padding: "5px 2px",
            border: `1px solid rgba(255,255,255,0.02)`
          }}>
            <div style={{ display: "flex", alignItems: "center", justify: "center", gap: 3, marginBottom: 2 }}>
              <Icon size={9} style={{ color: s.muted }} />
              <span style={{ fontSize: 8.5, color: s.muted, textTransform: "uppercase", letterSpacing: "0.02em" }}>{l}</span>
            </div>
            <div className="tabular-numbers" style={{ fontSize: 10.5, fontWeight: 700, color: s.light }}>{v}</div>
          </div>
        ))}
      </div>

      {run.is_tripped && (
        <div style={{ 
          marginTop: 10, 
          background: "rgba(248, 113, 113, 0.05)", 
          border: "1px solid rgba(248, 113, 113, 0.15)", 
          borderRadius: 8, 
          padding: "6px 10px", 
          fontSize: 9.5, 
          color: "#FCA5A5",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <Zap size={10} style={{ color: s.red }} />
          <span style={{ 
            overflow: "hidden", 
            textOverflow: "ellipsis", 
            whiteSpace: "nowrap",
            fontWeight: 500
          }}>
            {run.trip_message}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip ──────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel" style={{ 
      borderRadius: 8, 
      padding: "8px 12px", 
      fontSize: 11,
      border: `1px solid ${s.teal}30`,
      background: "rgba(17, 24, 39, 0.9)"
    }}>
      <div style={{ color: s.muted, marginBottom: 4, fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: s.teal }}>
        <Coins size={12} />
        <span>Cost (×0.001):</span>
        <span className="tabular-numbers">{payload[0]?.value?.toFixed(4)}</span>
      </div>
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
      try {
        const r = await fetch(`${API}/runs/${runId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data && data.run_id) setRun(data);
      } catch (e) {
        console.error(e);
      }
    };
    go();
    const iv = setInterval(go, 1000);
    return () => clearInterval(iv);
  }, [runId]);

  if (!runId) return (
    <div className="glass-panel" style={{ 
      borderRadius: 12, 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: 480,
      textAlign: "center",
      padding: 30
    }}>
      <div style={{ 
        width: 60, 
        height: 60, 
        borderRadius: "50%", 
        background: `radial-gradient(circle, ${s.teal}20 0%, transparent 70%)`,
        border: `1px solid ${s.teal}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16
      }}>
        <Zap size={24} style={{ color: s.teal }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: s.light, marginBottom: 6 }}>Telemetry Inactive</h3>
      <p style={{ color: s.muted, fontSize: 12, maxWidth: 320, lineHeight: 1.5 }}>
        Select an agent run execution from the history list, or configure a new loop to view detailed guardrail telemetry, costs, and token speed.
      </p>
    </div>
  );

  if (!run) return (
    <div className="glass-panel" style={{ 
      borderRadius: 12, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: 480 
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <RefreshCw size={20} className="heartbeat-dot" style={{ color: s.teal }} />
        <div style={{ color: s.muted, fontSize: 12, fontWeight: 500 }}>Connecting to telemetry database...</div>
      </div>
    </div>
  );

  const chartData = (run.iterations || []).map(it => ({
    name: `Step ${it.iteration}`,
    cost: parseFloat(((it.cost ?? 0) * 1000).toFixed(4)),
  }));

  const isRunning = run.status === "running";
  const isTripped = run.status === "tripped";

  return (
    <div className={`fade-in`} style={{
      background: s.surface,
      border: `1px solid ${isTripped ? "rgba(248, 113, 113, 0.25)" : isRunning ? "rgba(20, 184, 166, 0.25)" : s.border}`,
      borderRadius: 12, 
      padding: 24,
      boxShadow: "0 8px 30px rgba(0,0,0,0.2)"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="tabular-numbers" style={{ 
              fontFamily: "var(--font-mono)", 
              fontSize: 10.5, 
              color: s.muted,
              fontWeight: 600,
              background: "rgba(255,255,255,0.03)",
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${s.border}`
            }}>
              ID: {run.run_id}
            </span>
            {isTripped && <Tag color="red">Tripped</Tag>}
            {isRunning && <Tag color="teal">Running</Tag>}
            {run.status === "completed" && <Tag color="green">Completed</Tag>}
          </div>
          <h2 style={{ color: s.light, fontWeight: 800, fontSize: 16, maxWidth: 520, lineHeight: 1.4 }}>
            {run.topic}
          </h2>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="tabular-numbers" style={{ 
            fontSize: 26, 
            fontWeight: 900, 
            color: s.teal,
            textShadow: `0 0 15px ${s.tealGlow}`,
            lineHeight: 1
          }}>
            ${(run.total_cost_usd ?? 0).toFixed(4)}
          </div>
          <div style={{ fontSize: 9.5, color: s.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
            Total Accum. Cost
          </div>
        </div>
      </div>

      {/* Error State Callout */}
      {run.status === "error" && (
        <div style={{
          background: "rgba(248, 113, 113, 0.03)",
          border: "1px solid rgba(248, 113, 113, 0.20)",
          borderRadius: 10,
          padding: "16px",
          marginBottom: 20,
          boxShadow: `0 0 15px rgba(248, 113, 113, 0.02)`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: s.red, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
            <AlertTriangle size={14} />
            <span>EXECUTION ERROR</span>
          </div>
          <div style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 1.5, fontWeight: 500, fontFamily: "var(--font-mono)" }}>
            {run.trip_message || "An unexpected error occurred during execution."}
          </div>
        </div>
      )}

      {/* Trip alert callout */}
      {run.is_tripped && (
        <div style={{ 
          background: "rgba(248, 113, 113, 0.03)", 
          border: "1px solid rgba(248, 113, 113, 0.20)", 
          borderRadius: 10, 
          padding: "16px", 
          marginBottom: 20,
          boxShadow: `0 0 15px rgba(248, 113, 113, 0.02)`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: s.red, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
            <Zap size={14} fill="currentColor" />
            <span>CIRCUIT BREAKER TRIGGERED</span>
          </div>
          <div style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 1.5, fontWeight: 500 }}>
            {run.trip_message}
          </div>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: 12, 
            marginTop: 12, 
            borderTop: "1px solid rgba(248, 113, 113, 0.08)",
            paddingTop: 10
          }}>
            <div>
              <div style={{ fontSize: 9, color: s.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Trigger Engine Rule</div>
              <div style={{ fontSize: 11, color: s.light, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 2 }}>{run.trip_reason}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: s.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Est. Budget Saved</div>
              <div style={{ fontSize: 11, color: s.green, fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: 2 }}>
                ${((run.total_cost_usd ?? 0) * 2).toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Running State Callout */}
      {isRunning && (
        <div style={{
          background: "rgba(20, 184, 166, 0.03)",
          border: "1px solid rgba(20, 184, 166, 0.12)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <span className="heartbeat-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: s.teal, boxShadow: `0 0 8px ${s.teal}` }} />
          <span style={{ fontSize: 11.5, color: "#99F6E4", fontWeight: 500 }}>
            Real-time monitoring active. Telemetry stream is updating as agent triggers LLM calls.
          </span>
        </div>
      )}

      {/* Clean Completed Callout */}
      {run.status === "completed" && (
        <div style={{
          background: "rgba(16, 185, 129, 0.03)",
          border: "1px solid rgba(16, 185, 129, 0.12)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <CheckCircle2 size={14} style={{ color: s.green }} />
          <span style={{ fontSize: 11.5, color: "#6EE7B7", fontWeight: 500 }}>
            Agent completed execution cleanly without violating configured policy.
          </span>
        </div>
      )}

      {/* Stats grid */}
      <Label><Database size={10} /> Live Telemetry</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        <StatBox label="Iterations"    value={run.iteration_count} icon={Activity} />
        <StatBox label="Total Tokens"  value={run.total_tokens.toLocaleString()} icon={Cpu} />
        <StatBox label="Input Tokens"  value={run.total_input_tokens.toLocaleString()} icon={FileText} />
        <StatBox label="Output Tokens" value={run.total_output_tokens.toLocaleString()} icon={FileText} />
        <StatBox label="Elapsed"       value={`${(run.elapsed_seconds ?? 0).toFixed(1)}s`} icon={Clock} />
        <StatBox label="Tool Calls"    value={run.tool_calls?.length || 0} icon={Database} />
        <StatBox label="Max Iters"     value={run.config?.max_iterations} icon={Sliders} />
        <StatBox label="Max Cost"      value={`$${run.config?.max_cost_usd}`} icon={Coins} />
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div style={{ marginBottom: 22 }}>
          <Label><TrendingUp size={10} /> Cost Trajectory (×0.001 USD per iteration)</Label>
          <div style={{ 
            border: `1px solid ${s.border}`, 
            borderRadius: 10, 
            padding: "16px 10px 10px 0", 
            background: "rgba(10, 15, 26, 0.15)" 
          }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={s.teal} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={s.teal} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.06)" tick={{ fontSize: 10, fill: s.muted }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.06)" tick={{ fontSize: 10, fill: s.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="cost" stroke={s.teal} strokeWidth={2} fill="url(#g)"
                  dot={{ fill: s.teal, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: s.teal }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Timeline Audit Logs */}
      {(run.iterations || []).length > 0 && (
        <div>
          <Label><FileText size={10} /> Execution Timeline Logs</Label>
          <div style={{ 
            border: `1px solid ${s.border}`, 
            borderRadius: 10, 
            maxHeight: 260, 
            overflowY: "auto", 
            background: "rgba(10, 15, 26, 0.4)",
            padding: "16px"
          }}>
            {run.iterations.map((it, idx) => {
              const tool = run.tool_calls && run.tool_calls[idx];
              const isLast = idx === run.iterations.length - 1;
              const stepTripped = isLast && isTripped;
              
              return (
                <div key={idx} style={{ 
                  display: "flex", 
                  gap: 16, 
                  position: "relative",
                  paddingBottom: isLast ? 0 : 20
                }}>
                  {/* Timeline connectors */}
                  {!isLast && (
                    <div style={{
                      position: "absolute",
                      left: 7,
                      top: 16,
                      bottom: 0,
                      width: 2,
                      background: "rgba(255, 255, 255, 0.04)"
                    }} />
                  )}
                  
                  {/* Circle indicator */}
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: stepTripped ? s.red : isRunning && isLast ? s.teal : s.green,
                    border: `3px solid ${s.bg}`,
                    boxShadow: stepTripped ? `0 0 8px ${s.red}50` : isRunning && isLast ? `0 0 8px ${s.teal}50` : "none",
                    flexShrink: 0,
                    zIndex: 1,
                    marginTop: 2
                  }} className={isRunning && isLast ? "heartbeat-dot" : ""} />

                  {/* Log Content */}
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.light }}>
                        Step {it.iteration}: {tool ? `Executed tool [${tool}]` : "Processed Agent Loops"}
                      </span>
                      <span className="tabular-numbers" style={{ 
                        fontSize: 10, 
                        color: stepTripped ? s.red : s.teal,
                        fontWeight: 600
                      }}>
                        +${(it.cost ?? 0).toFixed(5)} ({it.tokens} tokens)
                      </span>
                    </div>

                    {/* Meta info / Mock terminal messages */}
                    <div style={{ 
                      marginTop: 4, 
                      fontSize: 11, 
                      color: s.muted, 
                      fontFamily: "var(--font-mono)",
                      lineHeight: 1.4,
                      background: "rgba(0,0,0,0.12)",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.01)"
                    }}>
                      <div style={{ color: "#E5E7EB", display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronRight size={10} style={{ color: s.teal }} />
                        <span>Question under study: "{run.topic}"</span>
                      </div>
                      {tool && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: s.muted, marginTop: 2 }}>
                          <CornerDownRight size={10} style={{ marginLeft: 6 }} />
                          <span>Parameters: query="{run.topic.substring(0, 30)}..."</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function ComparePanel() {
  const [topic, setTopic] = useState("Why is AGI hard to achieve?");
  const [maxIter, setMaxIter] = useState(6);
  const [maxCostInput, setMaxCostInput] = useState("2.00");
  const [maxCost, setMaxCost] = useState(2.0);
  const [rules, setRules] = useState([]);
  const [selectedRules, setSelectedRules] = useState(
    new Set(["cost_exceeded", "iterations_exceeded", "time_exceeded", "velocity_exceeded", "repeated_tool_calls"])
  );
  const [loading, setLoading] = useState(false);
  const [activeCompare, setActiveCompare] = useState(null);
  
  // Detailed states for unguarded and guarded runs to show live stats side-by-side
  const [ungRun, setUngRun] = useState(null);
  const [grdRun, setGrdRun] = useState(null);

  useEffect(() => {
    fetch(`${API}/rules`).then(r => r.json()).then(setRules).catch(console.error);
  }, []);

  const toggleRule = (id) => {
    setSelectedRules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Poll comparison run status
  useEffect(() => {
    if (!activeCompare || activeCompare.status === "done" || activeCompare.status === "error") return;

    let timer;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/compare/${activeCompare.compare_id}`);
        if (!res.ok) return;
        const data = await res.json();
        setActiveCompare(data);

        // Fetch unguarded details if id exists
        if (data.unguarded_run_id) {
          const uRes = await fetch(`${API}/runs/${data.unguarded_run_id}`);
          if (uRes.ok) setUngRun(await uRes.json());
        }
        // Fetch guarded details if id exists
        if (data.guarded_run_id) {
          const gRes = await fetch(`${API}/runs/${data.guarded_run_id}`);
          if (gRes.ok) setGrdRun(await gRes.json());
        }
      } catch (e) {
        console.error(e);
      }
    };

    timer = setInterval(poll, 1500);
    return () => clearInterval(timer);
  }, [activeCompare]);

  const handleStart = async () => {
    setLoading(true);
    setUngRun(null);
    setGrdRun(null);
    setActiveCompare(null);

    try {
      const r = await fetch(`${API}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          max_iterations: maxIter,
          max_cost_usd: maxCost,
          max_time_seconds: 120,
          max_velocity_per_10s: 0.5,
          rule_ids: Array.from(selectedRules),
        })
      });
      if (r.ok) {
        const d = await r.json();
        // Set initial compare state
        setActiveCompare({
          compare_id: d.compare_id,
          status: "running",
          topic
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isRunning = activeCompare && activeCompare.status === "running";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      {/* Config Form Card */}
      <div className="glass-panel" style={{ borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Sliders size={16} style={{ color: s.teal }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: s.light, letterSpacing: "0.02em" }}>Configure Compare Mode</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Label><Search size={10} /> Topic</Label>
          <Input value={topic} onChange={e => setTopic(e.target.value)} icon={Sparkles} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <Label><Activity size={10} /> Max Iterations</Label>
            <Input type="number" value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} />
          </div>
          <div>
            <Label><Coins size={10} /> Max Cost ($)</Label>
            <Input 
              type="text" 
              value={maxCostInput} 
              onChange={e => setMaxCostInput(e.target.value)} 
              onBlur={() => setMaxCost(parseFloat(maxCostInput) || 0)} 
            />
          </div>
        </div>

        <Label><FileText size={10} /> Guardrails (Guarded Run)</Label>
        <div style={{ 
          marginBottom: 16, 
          maxHeight: 180, 
          overflowY: "auto", 
          paddingRight: 4, 
          border: `1px solid ${s.border}`, 
          borderRadius: 8, 
          background: "rgba(10, 15, 26, 0.4)",
          padding: "4px 8px"
        }}>
          {rules.map(rule => (
            <label key={rule.id} className="custom-checkbox-wrapper" style={{
              display: "flex", 
              alignItems: "flex-start", 
              gap: 10,
              padding: "8px 0", 
              cursor: "pointer",
              borderBottom: rule.id !== rules[rules.length-1].id ? `1px solid ${s.border}` : "none"
            }}>
              <input
                type="checkbox"
                checked={selectedRules.has(rule.id)}
                onChange={() => toggleRule(rule.id)}
              />
              <div className="custom-switch-slider" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ marginLeft: 2 }}>
                <div style={{ fontSize: 11, color: s.light, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {rule.name}
                  {rule.severity === "warn" ? (
                    <Tag color="teal">Warning Only</Tag>
                  ) : (
                    <Tag color="red">STOP</Tag>
                  )}
                </div>
                <div style={{ fontSize: 9.5, color: s.muted, lineHeight: 1.3, marginTop: 2 }}>{rule.description}</div>
              </div>
            </label>
          ))}
        </div>

        <button onClick={handleStart} disabled={loading || isRunning} style={{
          width: "100%", 
          background: (loading || isRunning) ? "rgba(31, 41, 55, 0.8)" : `linear-gradient(135deg, ${s.teal}, ${s.green})`,
          color: s.light,
          border: "none", 
          borderRadius: 8, 
          padding: "11px 0",
          fontSize: 12, 
          fontWeight: 800, 
          cursor: (loading || isRunning) ? "default" : "pointer",
          letterSpacing: "0.06em", 
          textTransform: "uppercase", 
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: (loading || isRunning) ? "none" : `0 4px 14px ${s.tealGlow}`,
        }}
        onMouseEnter={(e) => {
          if (!loading && !isRunning) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 6px 18px rgba(20, 184, 166, 0.3)`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = (loading || isRunning) ? "none" : `0 4px 14px ${s.tealGlow}`;
        }}>
          {(loading || isRunning) ? (
            <>
              <RefreshCw size={14} className="heartbeat-dot" />
              <span>Comparing runs...</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>Run Side-by-Side</span>
            </>
          )}
        </button>
      </div>

      {/* Comparison Workspace */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!activeCompare && (
          <div className="glass-panel" style={{
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            textAlign: "center",
            padding: 30
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${s.blue}20 0%, transparent 70%)`,
              border: `1px solid ${s.blue}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16
            }}>
              <GitCompare size={24} style={{ color: s.blue }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: s.light, marginBottom: 6 }}>Side-by-Side Comparison Workspace</h3>
            <p style={{ color: s.muted, fontSize: 12, maxWidth: 400, lineHeight: 1.5 }}>
              Choose a topic and select your guardrail configuration. AgentBreaker will run a standard unguarded agent run first (up to 20 steps / $2 limit), followed by a guarded run using your policy, displaying their live telemetry side-by-side with automatic cost and token savings calculation.
            </p>
          </div>
        )}

        {activeCompare && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status Header */}
            <div className="glass-panel" style={{ borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: s.muted, fontFamily: "var(--font-mono)", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: 4 }}>
                      COMPARISON ID: {activeCompare.compare_id}
                    </span>
                    {isRunning ? (
                      <Tag color="blue">Running Live</Tag>
                    ) : activeCompare.status === "done" ? (
                      <Tag color="green">Done</Tag>
                    ) : (
                      <Tag color="red">Failed/Error</Tag>
                    )}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: s.light }}>{activeCompare.topic}</h3>
                </div>
                {isRunning && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: s.blue, fontSize: 12, fontWeight: 600 }}>
                    <RefreshCw size={14} className="heartbeat-dot" />
                    <span>
                      {!ungRun || ungRun.status === "running" 
                        ? "Executing Unguarded Run..." 
                        : "Executing Guarded Run..."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-Side Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Unguarded Panel */}
              <div className="glass-panel" style={{ 
                borderRadius: 12, 
                padding: 20, 
                border: `1px solid ${ungRun?.status === "running" ? s.red : s.border}`,
                boxShadow: ungRun?.status === "running" ? `0 0 15px ${s.redGlow}` : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.red }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.light }}>Unguarded Run</span>
                  </div>
                  {ungRun && (
                    <span style={{ fontSize: 9.5, color: s.muted, fontFamily: "var(--font-mono)" }}>
                      {ungRun.run_id}
                    </span>
                  )}
                </div>

                {ungRun ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <StatBox label="Iterations" value={ungRun.iteration_count} icon={Activity} />
                      <StatBox label="Total Spend" value={`$${(ungRun.total_cost_usd ?? 0).toFixed(4)}`} accent={s.red} icon={Coins} />
                    </div>
                    <StatBox label="Total Tokens" value={ungRun.total_tokens?.toLocaleString() || "0"} icon={Cpu} />
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: s.muted, borderTop: `1px solid ${s.border}`, paddingTop: 10, marginTop: 4 }}>
                      <span>Status:</span>
                      <span style={{ fontWeight: 700, color: ungRun.status === "running" ? s.red : s.light }}>
                        {ungRun.status.toUpperCase()}
                      </span>
                    </div>

                    {ungRun.status === "error" && (
                      <div style={{ 
                        background: "rgba(248, 113, 113, 0.05)", 
                        border: "1px solid rgba(248, 113, 113, 0.15)", 
                        borderRadius: 8, 
                        padding: "8px 10px", 
                        fontSize: 10.5, 
                        color: "#FCA5A5",
                        marginTop: 4
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: s.red, marginBottom: 2 }}>
                          <AlertTriangle size={11} />
                          <span>Error Occurred</span>
                        </div>
                        <span style={{ fontSize: 9.5, lineHeight: 1.3, fontFamily: "var(--font-mono)" }}>
                          {ungRun.trip_message || "Unexpected run error."}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justify: "center", minHeight: 140, color: s.muted, fontSize: 12 }}>
                    Waiting to start...
                  </div>
                )}
              </div>

              {/* Guarded Panel */}
              <div className="glass-panel" style={{ 
                borderRadius: 12, 
                padding: 20, 
                border: `1px solid ${grdRun?.status === "running" ? s.teal : grdRun?.status === "tripped" ? s.red : s.border}`,
                boxShadow: grdRun?.status === "running" ? `0 0 15px ${s.tealGlow}` : grdRun?.status === "tripped" ? `0 0 15px ${s.redGlow}` : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.teal }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.light }}>Guarded Run</span>
                  </div>
                  {grdRun && (
                    <span style={{ fontSize: 9.5, color: s.muted, fontFamily: "var(--font-mono)" }}>
                      {grdRun.run_id}
                    </span>
                  )}
                </div>

                {grdRun ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <StatBox label="Iterations" value={grdRun.iteration_count} icon={Activity} />
                      <StatBox label="Total Spend" value={`$${(grdRun.total_cost_usd ?? 0).toFixed(4)}`} accent={s.teal} icon={Coins} />
                    </div>
                    <StatBox label="Total Tokens" value={grdRun.total_tokens?.toLocaleString() || "0"} icon={Cpu} />

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: s.muted, borderTop: `1px solid ${s.border}`, paddingTop: 10, marginTop: 4 }}>
                      <span>Status:</span>
                      <span style={{ 
                        fontWeight: 700, 
                        color: grdRun.status === "running" ? s.teal : grdRun.status === "tripped" ? s.red : s.green 
                      }}>
                        {grdRun.status.toUpperCase()}
                      </span>
                    </div>

                    {grdRun.status === "error" && (
                      <div style={{ 
                        background: "rgba(248, 113, 113, 0.05)", 
                        border: "1px solid rgba(248, 113, 113, 0.15)", 
                        borderRadius: 8, 
                        padding: "8px 10px", 
                        fontSize: 10.5, 
                        color: "#FCA5A5",
                        marginTop: 4
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: s.red, marginBottom: 2 }}>
                          <AlertTriangle size={11} />
                          <span>Error Occurred</span>
                        </div>
                        <span style={{ fontSize: 9.5, lineHeight: 1.3, fontFamily: "var(--font-mono)" }}>
                          {grdRun.trip_message || "Unexpected run error."}
                        </span>
                      </div>
                    )}

                    {grdRun.is_tripped && (
                      <div style={{ 
                        background: "rgba(248, 113, 113, 0.05)", 
                        border: "1px solid rgba(248, 113, 113, 0.15)", 
                        borderRadius: 8, 
                        padding: "8px 10px", 
                        fontSize: 10.5, 
                        color: "#FCA5A5",
                        marginTop: 4
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: s.red, marginBottom: 2 }}>
                          <Zap size={11} fill="currentColor" />
                          <span>Guards Fired: {grdRun.trip_reason}</span>
                        </div>
                        <span style={{ fontSize: 9.5, lineHeight: 1.3 }}>{grdRun.trip_message}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justify: "center", minHeight: 140, color: s.muted, fontSize: 12 }}>
                    {activeCompare.status === "running" && (!ungRun || ungRun.status === "running") 
                      ? "Guarded run will start after unguarded completes..." 
                      : "Waiting to start..."}
                  </div>
                )}
              </div>
            </div>

            {/* Savings Banner */}
            {activeCompare.status === "done" && (
              <div style={{
                background: (ungRun?.status === "error" || grdRun?.status === "error")
                  ? `linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(248, 113, 113, 0.15) 100%)`
                  : `linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(20, 184, 166, 0.15) 100%)`,
                border: `1px solid ${(ungRun?.status === "error" || grdRun?.status === "error") ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                boxShadow: `0 8px 30px ${(ungRun?.status === "error" || grdRun?.status === "error") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)"}`,
                borderRadius: 12,
                padding: "20px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16
              }}>
                <div>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 6, 
                    color: (ungRun?.status === "error" || grdRun?.status === "error") ? s.red : s.green, 
                    fontSize: 11, 
                    fontWeight: 800, 
                    textTransform: "uppercase", 
                    letterSpacing: "0.08em", 
                    marginBottom: 4 
                  }}>
                    {(ungRun?.status === "error" || grdRun?.status === "error") ? (
                      <>
                        <AlertTriangle size={13} />
                        <span>Comparison Run Interrupted</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} fill="currentColor" />
                        <span>AgentBreaker Savings Analysis</span>
                      </>
                    )}
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 500, color: s.light, marginTop: 4, maxWidth: 550, lineHeight: 1.4 }}>
                    {(ungRun?.status === "error" || grdRun?.status === "error") ? (
                      <span>
                        One or both runs failed due to an execution error (e.g. Daily Token Limit Exceeded). Please review the errors in the cards above.
                      </span>
                    ) : activeCompare.tokens_saved > 0 ? (
                      <span>
                        Prevented runaway loop: Intercepted Guarded Run at iteration <strong style={{ color: s.teal }}>{grdRun?.iteration_count}</strong> instead of letting it run to iteration <strong style={{ color: s.red }}>{ungRun?.iteration_count}</strong> (tripped by: <strong style={{ color: s.red }}>{grdRun?.trip_reason || "policy limit"}</strong>).
                      </span>
                    ) : (
                      "Both runs completed cleanly within configured policy limits."
                    )}
                  </h4>
                </div>

                <div style={{ display: "flex", gap: 24 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ 
                      fontSize: 28, 
                      fontWeight: 900, 
                      color: (ungRun?.status === "error" || grdRun?.status === "error") ? s.muted : s.green, 
                      textShadow: (ungRun?.status === "error" || grdRun?.status === "error") ? "none" : `0 0 15px rgba(52, 211, 153, 0.2)` 
                    }}>
                      {(ungRun?.status === "error" || grdRun?.status === "error") ? "N/A" : `${activeCompare.cost_saved_pct}%`}
                    </div>
                    <div style={{ fontSize: 9.5, color: s.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Cost Saved
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ 
                      fontSize: 28, 
                      fontWeight: 900, 
                      color: (ungRun?.status === "error" || grdRun?.status === "error") ? s.muted : s.teal, 
                      textShadow: (ungRun?.status === "error" || grdRun?.status === "error") ? "none" : `0 0 15px rgba(20, 184, 166, 0.2)` 
                    }}>
                      {(ungRun?.status === "error" || grdRun?.status === "error") ? "N/A" : activeCompare.tokens_saved.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 9.5, color: s.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Tokens Saved
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [runs,     setRuns]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [page,     setPage]     = useState("console"); // "console" | "compare"

  const fetchRuns = useCallback(async () => {
    try {
      const r = await fetch(`${API}/runs`);
      setRuns(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const iv = setInterval(fetchRuns, 2000);
    return () => clearInterval(iv);
  }, [fetchRuns]);

  const handleStarted = id => { setSelected(id); setTimeout(fetchRuns, 500); };

  return (
    <div style={{ minHeight: "100vh", padding: "16px 28px 40px" }}>

      {/* Global Navigation Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: 30, 
        borderBottom: `1px solid ${s.border}`,
        paddingBottom: 16,
        flexWrap: "wrap",
        gap: 16
      }}>
        {/* Logo and title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ 
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${s.teal}, ${s.green})`,
            boxShadow: `0 0 15px rgba(20, 184, 166, 0.25)`
          }}>
            <Zap size={16} style={{ color: s.light }} fill={s.light} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: s.light, letterSpacing: "-0.03em" }}>
            Agent<span style={{ color: s.teal }}>Breaker</span>
          </span>
          <Tag color="teal">Console v1.2</Tag>
        </div>

        {/* Navigation links */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* GitHub Repository Link Button */}
          <a 
            href="https://github.com/vixde8/agentbreaker" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{
              textDecoration: "none",
              background: "rgba(255, 255, 255, 0.03)",
              border: `1px solid ${s.border}`,
              color: s.muted,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit"
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = s.light; 
              e.currentTarget.style.borderColor = s.teal; 
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = s.muted; 
              e.currentTarget.style.borderColor = s.border; 
            }}
          >
            <GitBranch size={13} />
            <span>GitHub</span>
          </a>

          {/* Navigation Links for Console vs Compare */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${s.border}`, borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setPage("console")}
              style={{
                background: page === "console" ? "rgba(20, 184, 166, 0.12)" : "transparent",
                border: "none",
                color: page === "console" ? s.teal : s.muted,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: page === "console" ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Zap size={13} />
              <span>Console</span>
            </button>
            <button
              onClick={() => setPage("compare")}
              style={{
                background: page === "compare" ? "rgba(20, 184, 166, 0.12)" : "transparent",
                border: "none",
                color: page === "compare" ? s.teal : s.muted,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: page === "compare" ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <GitCompare size={13} />
              <span>Compare Mode</span>
            </button>
          </div>
        </div>
      </div>

      <div className="fade-in">
        {/* Metrics bar */}
        <MetricsBar />

        {page === "console" ? (
          /* Console layout */
          <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
            {/* Left column */}
            <div>
              <StartRunForm onStarted={handleStarted} />
              
              <div style={{ 
                fontSize: 10, 
                fontWeight: 800, 
                color: s.muted, 
                textTransform: "uppercase", 
                letterSpacing: "0.08em", 
                margin: "20px 0 10px 4px",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <Activity size={10} />
                <span>Active Policy Executions</span>
                <span className="tabular-numbers" style={{ 
                  fontSize: 9, 
                  background: "rgba(255,255,255,0.05)", 
                  padding: "1px 5px", 
                  borderRadius: 4, 
                  marginLeft: "auto" 
                }}>{runs.length} runs</span>
              </div>
              
              {runs.length === 0 && (
                <div className="glass-panel" style={{ 
                  borderRadius: 10, 
                  padding: "20px 14px", 
                  textAlign: "center", 
                  borderStyle: "dashed" 
                }}>
                  <p style={{ color: s.muted, fontSize: 11 }}>No runs stored in the local database.</p>
                </div>
              )}
              
              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
                {runs.map(r => (
                  <RunCard 
                    key={r.run_id} 
                    run={r}
                    isSelected={selected === r.run_id}
                    onClick={() => setSelected(r.run_id)} 
                  />
                ))}
              </div>
            </div>

            {/* Right column */}
            <RunDetail runId={selected} />
          </div>
        ) : (
          /* Compare Panel layout */
          <ComparePanel />
        )}
      </div>
    </div>
  );
}
