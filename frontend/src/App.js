import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Zap, 
  Play, 
  Trash2, 
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
  Shield,
  Layers,
  ArrowRight,
  Code,
  GitBranch,
  ArrowLeftRight
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

// ── Landing/Homepage Component ──────────────────────────────────────────────
function HomePage({ onLaunch }) {
  const [activeFeature, setActiveFeature] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const features = [
    {
      title: "Cost Guardrails",
      short: "Abort loops instantly when a budget limit is violated.",
      icon: Coins,
      color: s.teal,
      preview: () => (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 11, color: s.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Cumulative Spend Alert</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: s.red, fontFamily: "var(--font-mono)", marginBottom: 8 }}>$2.0125</div>
          <div style={{ fontSize: 10, background: "rgba(248,113,113,0.1)", color: s.red, border: `1px solid ${s.red}20`, padding: "4px 10px", borderRadius: 6, display: "inline-block" }}>
            🔴 Threshold Violations: Limit $2.00
          </div>
        </div>
      )
    },
    {
      title: "Stuck Loop Detector",
      short: "Interrupt recursive actions executing duplicate tools.",
      icon: Shield,
      color: s.red,
      preview: () => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: s.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sequential Execution Check</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: 8, border: `1px solid ${s.border}` }}>
            <span style={{ fontSize: 11, color: s.light, fontFamily: "var(--font-mono)" }}>mock_search</span>
            <ArrowLeftRight size={12} style={{ color: s.red }} />
            <span style={{ fontSize: 11, color: s.light, fontFamily: "var(--font-mono)" }}>mock_search</span>
          </div>
          <div style={{ fontSize: 10, color: s.red, fontWeight: 700 }}>🚨 Stuck recursion loops flagged</div>
        </div>
      )
    },
    {
      title: "Spend Velocity Limits",
      short: "Flag fast-burning runs before they consume batch tokens.",
      icon: Layers,
      color: s.purple,
      preview: () => (
        <div style={{ width: "100%", padding: "5px 0" }}>
          <div style={{ fontSize: 11, color: s.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, textAlign: "center" }}>10s Spend Acceleration</div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: "85%", height: "100%", background: `linear-gradient(90deg, ${s.teal}, ${s.purple})` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: s.muted }}>
            <span>Safe Rate: $0.10/10s</span>
            <span style={{ color: s.purple, fontWeight: 700 }}>Current Rate: $0.48/10s</span>
          </div>
        </div>
      )
    },
    {
      title: "Observability Metrics",
      short: "Visual charts, iteration graphs, and detailed tool timeline logs.",
      icon: TrendingUp,
      color: s.green,
      preview: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          <div style={{ fontSize: 11, color: s.muted, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", marginBottom: 2 }}>Visual Step Timeline</div>
          <div style={{ background: "rgba(0,0,0,0.15)", border: `1px solid ${s.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 10.5, fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: s.light }}>Step 1: mock_search</span>
            <span style={{ color: s.teal }}>+$0.0035</span>
          </div>
          <div style={{ background: "rgba(0,0,0,0.15)", border: `1px solid ${s.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 10.5, fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: s.light }}>Step 2: mock_search</span>
            <span style={{ color: s.teal }}>+$0.0035</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 50, padding: "20px 0 80px" }}>
      {/* Symmetrical Hero Section */}
      <div style={{ 
        textAlign: "center", 
        maxWidth: 720, 
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${s.teal}, ${s.green})`,
          boxShadow: `0 0 25px rgba(20, 184, 166, 0.3)`,
          marginBottom: 20
        }}>
          <Zap size={22} style={{ color: s.light }} fill={s.light} />
        </div>
        
        <h1 style={{ 
          fontSize: 38, 
          fontWeight: 800, 
          color: s.light, 
          letterSpacing: "-0.03em",
          lineHeight: 1.2,
          marginBottom: 16
        }}>
          Autonomously Safeguard <br/>
          <span style={{ 
            background: `linear-gradient(90deg, ${s.teal}, ${s.green})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>AI Agent Loops</span>
        </h1>
        
        <p style={{ 
          color: s.muted, 
          fontSize: 14.5, 
          lineHeight: 1.6,
          maxWidth: 580,
          marginBottom: 28
        }}>
          AgentBreaker operates at the orchestration layer—monitoring costs, tokens, and velocity live. It intercepts infinite loops, repeated tool triggers, and token spikes, hard-stopping runaway agents before your API bill arrives.
        </p>

        <button 
          onClick={onLaunch}
          style={{
            background: `linear-gradient(135deg, ${s.teal}, ${s.green})`,
            color: s.light,
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: `0 4px 14px ${s.tealGlow}`,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 6px 18px rgba(20, 184, 166, 0.25)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = `0 4px 14px ${s.tealGlow}`;
          }}
        >
          <span>Launch Telemetry Console</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Symmetrical Vertical Carousel with Live Feature Preview */}
      <div 
        onMouseEnter={() => setAutoRotate(false)}
        onMouseLeave={() => setAutoRotate(true)}
        style={{ maxWidth: 900, width: "100%", margin: "0 auto" }}
      >
        <Label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, justifyContent: "center" }}>
          <Sliders size={12} style={{ color: s.teal }} />
          <span>Interactive Guardrail Library</span>
        </Label>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "280px 1fr", 
          gap: 20, 
          alignItems: "stretch" 
        }}>
          {/* Vertical tabs column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              const isActive = activeFeature === i;
              return (
                <div 
                  key={i} 
                  className={`carousel-vertical-tab ${isActive ? "active-tab" : ""}`}
                  onClick={() => setActiveFeature(i)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: isActive ? "rgba(20, 184, 166, 0.06)" : "rgba(17, 24, 39, 0.35)",
                    border: `1px solid ${isActive ? s.teal : s.border}`,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: isActive ? f.color : s.light }}>
                    <Icon size={14} style={{ color: isActive ? f.color : s.muted }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700 }}>{f.title}</span>
                  </div>
                  <div style={{ fontSize: 10, color: s.muted, lineHeight: 1.3 }}>{f.short}</div>
                </div>
              );
            })}
          </div>

          {/* Selected feature preview pane */}
          <div className="glass-panel" style={{ 
            borderRadius: 12, 
            padding: 24, 
            display: "flex", 
            flexDirection: "column",
            justifyContent: "space-between",
            background: "rgba(17, 24, 39, 0.4)",
            border: `1px solid ${s.border}`,
            minHeight: 280
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {(() => {
                  const Icon = features[activeFeature].icon;
                  return <Icon size={18} style={{ color: features[activeFeature].color }} />;
                })()}
                <h3 style={{ fontSize: 14, fontWeight: 700, color: s.light }}>{features[activeFeature].title}</h3>
              </div>
              <p style={{ fontSize: 12, color: s.muted, lineHeight: 1.6 }}>
                {features[activeFeature].short} Configurable threshold engine values prevent loop overrun issues. Adjust values directly inside the console to test active circuit-breaker responses.
              </p>
            </div>
            
            <div style={{ 
              background: "rgba(10, 15, 26, 0.55)", 
              borderRadius: 10, 
              border: `1px solid ${s.border}`, 
              padding: 24,
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.2)"
            }}>
              <div style={{ width: "100%", maxWidth: 360 }}>
                {features[activeFeature].preview()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Code Mockup */}
      <div style={{ maxWidth: 900, width: "100%", margin: "0 auto" }}>
        <Label style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          <Code size={12} style={{ color: s.teal }} />
          <span>Quick Integration SDK</span>
        </Label>
        
        <div style={{ 
          background: "rgba(10, 15, 26, 0.6)",
          border: `1px solid ${s.border}`,
          borderRadius: 12,
          padding: "16px 20px",
          textAlign: "left",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "#E5E7EB",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${s.border}`, paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.red }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.teal }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.green }} />
            </div>
            <div style={{ fontSize: 9.5, color: s.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>main.py</div>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <span style={{ color: s.teal }}>from</span> agentbreaker <span style={{ color: s.teal }}>import</span> CircuitBreaker, Rule
            <br />
            <br />
            {"# 1. Define safety policy rules"}
            <br />
            rules = [
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;Rule.cost_exceeded(limit_usd=<span style={{ color: s.green }}>2.00</span>),
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;Rule.stuck_loop(min_consecutive_repeats=<span style={{ color: s.green }}>2</span>),
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;Rule.velocity_exceeded(limit_usd=<span style={{ color: s.green }}>0.50</span>, interval_seconds=<span style={{ color: s.green }}>10</span>)
            <br />
            ]
            <br />
            <br />
            {"# 2. Wrap LLM execution loop"}
            <br />
            breaker = CircuitBreaker(rules=rules)
            <br />
            <span style={{ color: s.teal }}>with</span> breaker.monitor(topic=<span style={{ color: s.green }}>"AGI Research"</span>) <span style={{ color: s.teal }}>as</span> run:
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: s.teal }}>for</span> step <span style={{ color: s.teal }}>in</span> range(<span style={{ color: s.green }}>10</span>):
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;response = run.call_llm(prompt)
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{"# Auto-checks limits and halts loop if tripped"}
          </div>
        </div>
      </div>

      {/* Symmetrical Architecture Node Diagram */}
      <div style={{ textAlign: "center", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <Label style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          <Code size={12} style={{ color: s.teal }} />
          <span>SDK Execution Path</span>
        </Label>
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: 16, 
          background: "rgba(17, 24, 39, 0.25)",
          border: `1px solid ${s.border}`,
          borderRadius: 12,
          padding: "20px 24px",
          flexWrap: "wrap"
        }}>
          <div style={{ background: "rgba(10, 15, 26, 0.5)", border: `1px solid ${s.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 700, color: s.light }}>
            SDK Client Wrapper
          </div>
          <ArrowRight size={14} style={{ color: s.teal }} />
          <div style={{ background: "rgba(20, 184, 166, 0.05)", border: `1px solid ${s.teal}30`, borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 700, color: s.teal }}>
            Circuit Breaker Engine
          </div>
          <ArrowRight size={14} style={{ color: s.teal }} />
          <div style={{ background: "rgba(10, 15, 26, 0.5)", border: `1px solid ${s.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 11.5, fontWeight: 700, color: s.light }}>
            Safe LLM Executions
          </div>
        </div>
      </div>

      {/* Supported Integrations */}
      <div style={{ maxWidth: 900, width: "100%", margin: "0 auto", textAlign: "center" }}>
        <Label style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          <Layers size={12} style={{ color: s.teal }} />
          <span>Supported Frameworks & Orchestrators</span>
        </Label>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(5, 1fr)", 
          gap: 12,
          marginTop: 8
        }}>
          {[
            { name: "LangChain", desc: "Python & JS SDK" },
            { name: "LlamaIndex", desc: "Data Agents" },
            { name: "CrewAI", desc: "Multi-Agent Systems" },
            { name: "AutoGPT", desc: "Autonomous Loops" },
            { name: "Semantic Kernel", desc: "Enterprise Orchestration" }
          ].map((f, i) => (
            <div key={i} style={{ 
              background: "rgba(17, 24, 39, 0.25)",
              border: `1px solid ${s.border}`,
              borderRadius: 8,
              padding: "12px 6px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.light, marginBottom: 2 }}>{f.name}</div>
              <div style={{ fontSize: 8.5, color: s.muted }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div style={{ maxWidth: 900, width: "100%", margin: "0 auto" }}>
        <Label style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          <Shield size={12} style={{ color: s.teal }} />
          <span>Frequently Asked Questions</span>
        </Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            {
              q: "How does AgentBreaker intercept infinite agent loops?",
              a: "By wrapping your agent's execution layer, AgentBreaker monitors tool calls and costs in real-time. If it detects duplicate tool arguments, consecutive loops, or spend spikes matching your defined policy rules, it triggers a hard Halt exception, stopping runaway executions."
            },
            {
              q: "Does this affect the prompt response latency?",
              a: "No. The rules engine runs locally in-memory with sub-millisecond validation checks. It inspects metadata of the calls without introducing network overhead or proxy delays to your primary LLM endpoint."
            },
            {
              q: "Is it compatible with custom LLMs and hosting platforms?",
              a: "Yes. The SDK operates at the orchestration level, meaning it is compatible with Groq, OpenAI, Anthropic, local Llama instances, or any custom API client. It integrates seamlessly into any standard Python or Javascript framework."
            }
          ].map((item, idx) => (
            <details 
              key={idx} 
              style={{ 
                background: "rgba(17, 24, 39, 0.35)", 
                border: `1px solid ${s.border}`, 
                borderRadius: 10, 
                padding: "12px 16px",
                cursor: "pointer"
              }}
              className="faq-details"
            >
              <summary style={{ 
                fontSize: 12.5, 
                fontWeight: 700, 
                color: s.light, 
                outline: "none", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                listStyle: "none"
              }}>
                <span>{item.q}</span>
                <span style={{ color: s.teal, fontSize: 14 }}>+</span>
              </summary>
              <p style={{ 
                fontSize: 11.5, 
                color: s.muted, 
                lineHeight: 1.6, 
                marginTop: 10, 
                borderTop: `1px solid rgba(255,255,255,0.03)`,
                paddingTop: 8,
                cursor: "default"
              }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Premium Footer */}
      <div style={{ 
        maxWidth: 900, 
        width: "100%", 
        margin: "40px auto 0", 
        paddingTop: 24, 
        borderTop: `1px solid ${s.border}`,
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Zap size={14} style={{ color: s.teal }} fill={s.teal} />
            <span style={{ fontSize: 13, fontWeight: 900, color: s.light }}>Agent<span style={{ color: s.teal }}>Breaker</span></span>
          </div>
          <div style={{ fontSize: 9.5, color: s.muted }}>Autonomously safeguarding agent loops at the orchestration layer.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: s.muted }}>
          <a href="https://github.com/vixde8/agentbreaker" target="_blank" rel="noreferrer" style={{ color: s.muted, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = s.teal} onMouseLeave={e => e.target.style.color = s.muted}>Docs</a>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
          <a href="https://github.com/vixde8/agentbreaker" target="_blank" rel="noreferrer" style={{ color: s.muted, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = s.teal} onMouseLeave={e => e.target.style.color = s.muted}>Status</a>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
          <a href="https://github.com/vixde8/agentbreaker" target="_blank" rel="noreferrer" style={{ color: s.muted, textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = s.teal} onMouseLeave={e => e.target.style.color = s.muted}>GitHub</a>
        </div>
        <div style={{ fontSize: 9.5, color: s.muted }}>
          © 2026 AgentBreaker. Open Source under MIT License.
        </div>
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [page,     setPage]     = useState(
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
      ? "console" 
      : "home"
  ); // defaults to console on local dev, home on production
  const [runs,     setRuns]     = useState([]);
  const [selected, setSelected] = useState(null);

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
  
  const handleClear = async () => {
    try {
      await fetch(`${API}/runs`, { method: "DELETE" }); 
      setRuns([]); 
      setSelected(null); 
    } catch (e) {
      console.error(e);
    }
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("home")}>
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
          <button 
            onClick={() => setPage("home")}
            style={{
              background: page === "home" ? "rgba(255, 255, 255, 0.05)" : "transparent",
              border: `1px solid ${page === "home" ? s.border : "transparent"}`,
              color: page === "home" ? s.light : s.muted,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit"
            }}
          >
            Product Overview
          </button>
          
          <button 
            onClick={() => setPage("console")}
            style={{
              background: page === "console" ? "rgba(255, 255, 255, 0.05)" : "transparent",
              border: `1px solid ${page === "console" ? s.border : "transparent"}`,
              color: page === "console" ? s.light : s.muted,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            Telemetry Console
            {runs.some(r => r.status === "running") && (
              <span className="heartbeat-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: s.teal }} />
            )}
          </button>

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
        </div>

        {/* Action Button (Database reset) */}
        {page === "console" && (
          <button onClick={handleClear} style={{
            background: "rgba(248, 113, 113, 0.04)",
            border: `1px solid rgba(248, 113, 113, 0.15)`,
            color: "#FCA5A5", 
            borderRadius: 8, 
            padding: "8px 16px",
            fontSize: 11, 
            fontWeight: 700,
            cursor: "pointer", 
            letterSpacing: "0.04em",
            textTransform: "uppercase", 
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(248, 113, 113, 0.08)";
            e.currentTarget.style.borderColor = s.red;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(248, 113, 113, 0.04)";
            e.currentTarget.style.borderColor = "rgba(248, 113, 113, 0.15)";
          }}>
            <Trash2 size={13} />
            Reset DB
          </button>
        )}
      </div>

      {/* Main Pages */}
      {page === "home" ? (
        <HomePage onLaunch={() => setPage("console")} />
      ) : (
        <div className="fade-in">
          {/* Metrics bar */}
          <MetricsBar />

          {/* Console layout */}
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
        </div>
      )}
    </div>
  );
}