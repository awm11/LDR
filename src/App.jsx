import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo, SiteFooter } from "./Branding.jsx";

/* ------------------------------------------------------------------
   Light-dependent resistor (LDR) in a potential divider

   A lamp shines on an LDR wired in series with a fixed resistor. The
   battery's voltage is shared between them in proportion to their
   resistance, and a voltmeter reads the share across the LDR.

   The current animation overlay (red dashes running along the wires)
   is the one used in uses-of-electromagnets: same colour, dash pattern
   and direction, but its speed and brightness follow the current.
   ------------------------------------------------------------------ */

const C = {
  ink: "#202020",
  amber: "#d97706",
  green: "#2d9b55",
  greenDark: "#1f6b3a",
  muted: "#59636f",
  grey: "#374151",
  copper: "#b86f32",
  blue: "#1d4ed8",
  beam: "#fde047",
  flow: "#ff2200",
};

/* ---------------- Physics ---------------- */

const LIGHT_MAX = 10;
// Resistance falls steeply as the light gets brighter: about 145 Ω in
// the dark, under 1 Ω in bright light (values chosen to keep the sums
// friendly, not to match a real component).
const ldrResistance = (light) => 14.5 / (light * light + 0.1);
const R_DARK = ldrResistance(0);

const fmtR = (r) => (r >= 10 ? r.toFixed(1) : r.toFixed(2));
const fmtV = (v) => v.toFixed(2);
const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* ---------------- Geometry (viewBox 0 0 1000 620) ---------------- */

// Resistance–light-intensity graph, in its own box above the lamp
const GBOX = { x: 12, y: 24, w: 300, h: 238 };
const G = { x0: GBOX.x + 40, y0: GBOX.y + 166, w: 236, h: 116 };
const graphX = (light) => G.x0 + (light / LIGHT_MAX) * G.w;
// Squashed vertical scale so the whole curve fits ("not to scale")
const graphY = (r) => G.y0 - (G.h * Math.log(1 + r)) / Math.log(1 + R_DARK);

// Circuit
const TOP = 150;
const BOT = 400;
const LEFT = 410;
const RIGHT = 890;
const BAT = { long1: 626, short1: 639, long2: 663, short2: 676 };
const LDR = { x: 530, y: BOT, r: 40, half: 23 }; // half = half the body length
const RES = { x: 760, w: 100, h: 40 };
const VM = { x: 530, y: 510, r: 30, left: 462, right: 598 };
const AM = { x: RIGHT, y: (TOP + BOT) / 2, r: 28 }; // ammeter, in the right-hand wire

// Conventional current leaves the + terminal (the long plate on the left)
const FLOW_PATHS = [
  `M${BAT.long1},${TOP} H${LEFT} V${BOT} H${LDR.x - LDR.half}`,
  `M${LDR.x + LDR.half},${BOT} H${RES.x - RES.w / 2}`,
  `M${RES.x + RES.w / 2},${BOT} H${RIGHT} V${AM.y + AM.r}`,
  `M${RIGHT},${AM.y - AM.r} V${TOP} H${BAT.short2}`,
];

const WIRES = [
  `M${BAT.long1},${TOP} H${LEFT} V${BOT} H${LDR.x - LDR.half}`,
  `M${LDR.x + LDR.half},${BOT} H${RES.x - RES.w / 2}`,
  `M${RES.x + RES.w / 2},${BOT} H${RIGHT} V${AM.y + AM.r}`,
  `M${RIGHT},${AM.y - AM.r} V${TOP} H${BAT.short2}`,
  `M${BAT.short1},${TOP} H${BAT.long2}`,
  // Voltmeter, in parallel with the LDR
  `M${VM.left},${BOT} V${VM.y} H${VM.x - VM.r}`,
  `M${VM.x + VM.r},${VM.y} H${VM.right} V${BOT}`,
];

// Lamp head: pivot and the angle it points at the LDR
const HEAD = { x: 125, y: 318 };
const AIM = (Math.atan2(LDR.y - HEAD.y, LDR.x - HEAD.x) * 180) / Math.PI;

// The visible part of the drawing, with room for the sliders
const VB = { x: 0, y: 16, w: 930, h: 644 };

// Each slider sits by the thing it changes: centre x, top y, width
// (scene units)
const CTL = {
  light: { x: 105, y: 600, w: 150 },
  battery: { x: (BAT.long1 + BAT.short2) / 2, y: 50, w: 110 },
  fixed: { x: RES.x, y: 432, w: 110 },
};

/* ------------------------------------------------------------------
   Current animation overlay

   The dashes are the uses-of-electromagnets overlay (5 on, 7 off, red),
   but driven from requestAnimationFrame rather than a fixed CSS
   keyframe so the speed can follow the current smoothly while a slider
   is being dragged.
   ------------------------------------------------------------------ */

function useFlowOffset(svgRef, speed, reduceMotion) {
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    if (reduceMotion) {
      svg.style.setProperty("--flow-offset", "0");
      return undefined;
    }
    let raf;
    let last = performance.now();
    let offset = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      offset = (offset - speedRef.current * dt) % 24;
      svg.style.setProperty("--flow-offset", offset.toFixed(2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [svgRef, reduceMotion]);
}

function Wire({ d }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={C.ink}
      strokeWidth="3.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function FlowOverlay({ d }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={C.flow}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ldr-flow"
    />
  );
}

/* ---------------- Drawing pieces ---------------- */

function Graph({ light, rLdr, collapsed, onToggle }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const l = (i / 200) * LIGHT_MAX;
      pts.push(`${graphX(l).toFixed(1)},${graphY(ldrResistance(l)).toFixed(1)}`);
    }
    return pts.join(" ");
  }, []);

  const px = graphX(light);
  const py = graphY(rLdr);

  return (
    <g>
      <rect
        x={GBOX.x}
        y={GBOX.y}
        width={GBOX.w}
        height={collapsed ? 40 : GBOX.h}
        rx="12"
        fill="#fafbfc"
        stroke="#d9dee4"
        strokeWidth="1.2"
      />
      <text x={GBOX.x + 14} y={GBOX.y + 24} fontSize="12.5" fontWeight="800" letterSpacing="1" fill="#3867a8">
        LDR RESISTANCE
        <tspan fontWeight="500" letterSpacing="0" fill={C.muted}>
          {" "}
          (not to scale)
        </tspan>
      </text>

      {!collapsed && (
        <>
          <line x1={G.x0} y1={G.y0} x2={G.x0 + G.w + 10} y2={G.y0} stroke={C.grey} strokeWidth="1.6" />
          <line x1={G.x0} y1={G.y0} x2={G.x0} y2={G.y0 - G.h - 10} stroke={C.grey} strokeWidth="1.6" />
          <polyline points={points} fill="none" stroke="#4b5563" strokeWidth="2.4" strokeLinejoin="round" />
          <line x1={px} y1={G.y0} x2={px} y2={py} stroke={C.blue} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
          <circle cx={px} cy={py} r="6.5" fill="#4f6cf7" stroke="#1e3a8a" strokeWidth="1.5" />
          <text x={px + 9} y={py - 10} fontSize="15" fontWeight="600" fill={C.blue}>
            R
          </text>
          <text
            x={G.x0 - 14}
            y={G.y0 - G.h / 2}
            fontSize="13"
            fill={C.ink}
            textAnchor="middle"
            transform={`rotate(-90 ${G.x0 - 14} ${G.y0 - G.h / 2})`}
          >
            Resistance
          </text>
          <text x={G.x0 + G.w / 2} y={G.y0 + 20} fontSize="13" fill={C.ink} textAnchor="middle">
            Light intensity
          </text>

          {/* Reading for the point on the curve */}
          <line x1={GBOX.x + 14} y1={GBOX.y + GBOX.h - 30} x2={GBOX.x + GBOX.w - 14} y2={GBOX.y + GBOX.h - 30} stroke="#e5e8ec" />
          <text x={GBOX.x + 14} y={GBOX.y + GBOX.h - 10} fontSize="16" fill={C.blue}>
            R<tspan fontSize="11" dy="4">LDR</tspan>
          </text>
          <text
            x={GBOX.x + GBOX.w - 14}
            y={GBOX.y + GBOX.h - 10}
            fontSize="16"
            fontWeight="700"
            fill={C.blue}
            textAnchor="end"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmtR(rLdr)} Ω
          </text>
        </>
      )}

      {/* Minimise / expand */}
      <g
        className="gBtn"
        role="button"
        tabIndex={0}
        aria-label={collapsed ? "Show the resistance graph" : "Minimise the resistance graph"}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <rect x={GBOX.x + GBOX.w - 36} y={GBOX.y + 8} width="26" height="24" rx="6" fill="#fff" stroke="#d9dee4" strokeWidth="1.2" />
        <path
          d={
            collapsed
              ? `M${GBOX.x + GBOX.w - 29},${GBOX.y + 20} h12 M${GBOX.x + GBOX.w - 23},${GBOX.y + 14} v12`
              : `M${GBOX.x + GBOX.w - 29},${GBOX.y + 20} h12`
          }
          stroke={C.ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

/* ---------------- Anglepoise desk lamp ---------------- */

const LAMP_BASE = { x: 92, y: 556 };
const LAMP_FOOT = { x: 92, y: 532 }; // lower arm pivot on the base
const LAMP_ELBOW = { x: 26, y: 424 };

// Unit normal to the segment a→b, scaled by d
function normal(a, b, d) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return { x: (-dy / len) * d, y: (dx / len) * d };
}

// Twin parallel rods between two joints
function Arm({ a, b }) {
  const n = normal(a, b, 4.5);
  return (
    <g strokeLinecap="round">
      {[1, -1].map((s) => (
        <g key={s}>
          <line x1={a.x + n.x * s} y1={a.y + n.y * s} x2={b.x + n.x * s} y2={b.y + n.y * s} stroke="#5b636c" strokeWidth="4.2" />
          <line x1={a.x + n.x * s} y1={a.y + n.y * s} x2={b.x + n.x * s} y2={b.y + n.y * s} stroke="#c9d0d7" strokeWidth="1.6" />
        </g>
      ))}
    </g>
  );
}

// Tension spring running alongside an arm
function Spring({ a, b, side = 1 }) {
  const off = normal(a, b, 13 * side);
  const amp = normal(a, b, 4);
  const coils = 11;
  const t0 = 0.22;
  const t1 = 0.72;
  const pt = (t) => ({
    x: a.x + (b.x - a.x) * t + off.x,
    y: a.y + (b.y - a.y) * t + off.y,
  });
  const start = pt(t0);
  const end = pt(t1);
  let d = `M${start.x.toFixed(1)},${start.y.toFixed(1)}`;
  for (let i = 1; i < coils * 2; i++) {
    const p = pt(t0 + ((t1 - t0) * i) / (coils * 2));
    const s = i % 2 ? 1 : -1;
    d += ` L${(p.x + amp.x * s).toFixed(1)},${(p.y + amp.y * s).toFixed(1)}`;
  }
  d += ` L${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  // Hooks back to the arm at each end
  const hookA = pt(t0 - 0.06);
  const hookB = pt(t1 + 0.06);
  const onArm = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const ha = onArm(t0 - 0.1);
  const hb = onArm(t1 + 0.1);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${ha.x},${ha.y} L${hookA.x},${hookA.y} L${start.x},${start.y}`} stroke="#6b7280" strokeWidth="1.4" />
      <path d={`M${end.x},${end.y} L${hookB.x},${hookB.y} L${hb.x},${hb.y}`} stroke="#6b7280" strokeWidth="1.4" />
      <path d={d} stroke="#6b7280" strokeWidth="1.8" />
    </g>
  );
}

function Joint({ x, y, r = 7 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="url(#lampChrome)" stroke="#4b5563" strokeWidth="1.2" />
      <circle cx={x} cy={y} r={r * 0.35} fill="#4b5563" />
    </g>
  );
}

const beamOpacityAt = (light) => 0.06 + (0.6 * light) / LIGHT_MAX;

// The cone of light from the lamp
function Beam({ opacity }) {
  return (
    <g transform={`translate(${HEAD.x} ${HEAD.y}) rotate(${AIM})`} pointerEvents="none">
      <polygon points="86,-42 470,-150 470,150 86,42" fill="url(#beamGrad)" opacity={opacity} />
    </g>
  );
}

function Lamp({ light }) {
  const k = light / LIGHT_MAX;
  const on = k > 0.005;
  const beamOpacity = beamOpacityAt(light);

  return (
    <g>
      <defs>
        <linearGradient id="lampEnamel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2725a" />
          <stop offset="0.45" stopColor="#c2412d" />
          <stop offset="1" stopColor="#7f2416" />
        </linearGradient>
        <linearGradient id="lampBaseSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7f2416" />
          <stop offset="0.35" stopColor="#c2412d" />
          <stop offset="0.6" stopColor="#d9604a" />
          <stop offset="1" stopColor="#7f2416" />
        </linearGradient>
        <linearGradient id="lampChrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f4f6" />
          <stop offset="0.5" stopColor="#a8b0b9" />
          <stop offset="1" stopColor="#6b7280" />
        </linearGradient>
        <radialGradient id="lampMouth" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={on ? "#fffbe6" : "#d1d5db"} />
          <stop offset="0.55" stopColor={on ? "#fde68a" : "#9ca3af"} />
          <stop offset="1" stopColor={on ? "#f59e0b" : "#6b7280"} />
        </radialGradient>
        <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7c2" stopOpacity="1" />
          <stop offset="0.4" stopColor={C.beam} stopOpacity="0.7" />
          <stop offset="1" stopColor={C.beam} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Beam, drawn first so the circuit sits on top of it */}
      <Beam opacity={beamOpacity} />

      {/* Shadow and weighted base */}
      <ellipse cx={LAMP_BASE.x + 6} cy={LAMP_BASE.y + 20} rx="82" ry="11" fill="#1f2937" opacity="0.12" />
      <path
        d={`M${LAMP_BASE.x - 70},${LAMP_BASE.y} v12 a70,16 0 0 0 140,0 v-12 z`}
        fill="url(#lampBaseSide)"
        stroke="#6b1d12"
        strokeWidth="1.2"
      />
      <ellipse cx={LAMP_BASE.x} cy={LAMP_BASE.y} rx="70" ry="16" fill="url(#lampEnamel)" stroke="#6b1d12" strokeWidth="1.2" />
      <ellipse cx={LAMP_BASE.x - 14} cy={LAMP_BASE.y - 5} rx="36" ry="5" fill="#fff" opacity="0.22" />
      {/* Pivot bracket on the base */}
      <path
        d={`M${LAMP_FOOT.x - 12},${LAMP_BASE.y - 2} L${LAMP_FOOT.x - 7},${LAMP_FOOT.y} L${LAMP_FOOT.x + 7},${LAMP_FOOT.y} L${LAMP_FOOT.x + 12},${LAMP_BASE.y - 2} Z`}
        fill="url(#lampChrome)"
        stroke="#4b5563"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Mains cable */}
      <path
        d={`M${LAMP_BASE.x + 66},${LAMP_BASE.y + 8} C${LAMP_BASE.x + 100},${LAMP_BASE.y + 18} ${LAMP_BASE.x + 110},${LAMP_BASE.y + 30} ${LAMP_BASE.x + 150},${LAMP_BASE.y + 28}`}
        fill="none"
        stroke="#374151"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Arms and springs */}
      <Spring a={LAMP_FOOT} b={LAMP_ELBOW} side={-1} />
      <Arm a={LAMP_FOOT} b={LAMP_ELBOW} />
      <Spring a={LAMP_ELBOW} b={HEAD} side={1} />
      <Arm a={LAMP_ELBOW} b={HEAD} />
      <Joint x={LAMP_FOOT.x} y={LAMP_FOOT.y} />
      <Joint x={LAMP_ELBOW.x} y={LAMP_ELBOW.y} r={8} />

      {/* Shade, pointing at the LDR */}
      <g transform={`translate(${HEAD.x} ${HEAD.y}) rotate(${AIM})`}>
        {/* Glow around the opening */}
        <ellipse cx="90" cy="0" rx={30 + 26 * k} ry={52 + 26 * k} fill="url(#lampGlow)" opacity={on ? 0.25 + 0.75 * k : 0} />
        <path
          d="M-10,-16 C-30,-16 -30,16 -10,16 L20,18 C46,24 68,34 86,42 L86,-42 C68,-34 46,-24 20,-18 Z"
          fill="url(#lampEnamel)"
          stroke="#6b1d12"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Highlight along the top of the shade */}
        <path d="M-14,-11 C-4,-13 10,-14 22,-14 C44,-18 62,-26 78,-34" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        {/* Ventilation band */}
        <path d="M18,-18 L18,18" stroke="#6b1d12" strokeWidth="1.2" opacity="0.7" />
        <path d="M24,-19 L24,19" stroke="#6b1d12" strokeWidth="1.2" opacity="0.7" />
        {/* Open end, with the bulb showing inside */}
        <ellipse cx="86" cy="0" rx="10" ry="42" fill="url(#lampMouth)" stroke="#6b1d12" strokeWidth="1.6" />
        <ellipse cx="88" cy="0" rx="5" ry="14" fill={on ? "#ffffff" : "#e5e7eb"} opacity={on ? 0.5 + 0.5 * k : 0.6} />
        {/* Switch knob on the back */}
        <rect x="-34" y="-5" width="8" height="10" rx="2" fill="#374151" />
      </g>
      <Joint x={HEAD.x} y={HEAD.y} />
    </g>
  );
}

function Battery() {
  return (
    <g>
      <line x1={BAT.long1} y1={TOP - 26} x2={BAT.long1} y2={TOP + 26} stroke={C.ink} strokeWidth="3.6" />
      <line x1={BAT.short1} y1={TOP - 14} x2={BAT.short1} y2={TOP + 14} stroke={C.ink} strokeWidth="5" />
      <line x1={BAT.long2} y1={TOP - 26} x2={BAT.long2} y2={TOP + 26} stroke={C.ink} strokeWidth="3.6" />
      <line x1={BAT.short2} y1={TOP - 14} x2={BAT.short2} y2={TOP + 14} stroke={C.ink} strokeWidth="5" />
      <text x={BAT.long1 - 14} y={TOP - 18} fontSize="18" fill={C.ink} textAnchor="middle">
        +
      </text>
    </g>
  );
}

// Two parallel arrows of light, pointing in towards the LDR at 45°
function lightArrow(angleDeg) {
  const t = (angleDeg * Math.PI) / 180;
  const tip = { x: LDR.x + (LDR.r + 5) * Math.cos(t), y: LDR.y + (LDR.r + 5) * Math.sin(t) };
  const dir = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  const len = 36;
  const head = 10;
  const wing = 5.5;
  const tail = { x: tip.x - dir.x * len, y: tip.y - dir.y * len };
  const base = { x: tip.x - dir.x * head, y: tip.y - dir.y * head };
  const n = { x: -dir.y, y: dir.x };
  return {
    shaft: `M${tail.x.toFixed(1)},${tail.y.toFixed(1)} L${base.x.toFixed(1)},${base.y.toFixed(1)}`,
    head: `M${tip.x.toFixed(1)},${tip.y.toFixed(1)} L${(base.x + n.x * wing).toFixed(1)},${(base.y + n.y * wing).toFixed(1)} L${(base.x - n.x * wing).toFixed(1)},${(base.y - n.y * wing).toFixed(1)} Z`,
  };
}
const LIGHT_ARROWS = [lightArrow(-112), lightArrow(-152)];

function LdrSymbol({ light }) {
  const k = light / LIGHT_MAX;
  return (
    <g>
      <defs>
        <radialGradient id="ldrGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.7" stopColor={C.beam} />
          <stop offset="1" stopColor="#facc15" />
        </radialGradient>
      </defs>

      {/* Case: white, glowing yellow as the light on it gets brighter */}
      <circle cx={LDR.x} cy={LDR.y} r={LDR.r} fill="#fff" />
      <circle cx={LDR.x} cy={LDR.y} r={LDR.r} fill="url(#ldrGlow)" opacity={0.4 * k} />
      <circle cx={LDR.x} cy={LDR.y} r={LDR.r} fill="none" stroke={C.ink} strokeWidth="2.6" />

      {/* Leads inside the case, then the resistor body */}
      <line x1={LDR.x - LDR.r} y1={LDR.y} x2={LDR.x - LDR.half} y2={LDR.y} stroke={C.ink} strokeWidth="3.6" />
      <line x1={LDR.x + LDR.half} y1={LDR.y} x2={LDR.x + LDR.r} y2={LDR.y} stroke={C.ink} strokeWidth="3.6" />
      <rect
        x={LDR.x - LDR.half}
        y={LDR.y - 9}
        width={LDR.half * 2}
        height="18"
        fill="#fff"
        stroke={C.ink}
        strokeWidth="2.6"
      />

      {/* Light falling on it */}
      {LIGHT_ARROWS.map((a) => (
        <g key={a.head}>
          <path d={a.shaft} stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
          <path d={a.head} fill={C.ink} stroke={C.ink} strokeWidth="1" strokeLinejoin="round" />
        </g>
      ))}

    </g>
  );
}

// Ammeter in series, with its digital display just inside the circuit
function Ammeter({ current }) {
  return (
    <g>
      <circle cx={AM.x} cy={AM.y} r={AM.r} fill="#fff" stroke={C.ink} strokeWidth="2.6" />
      <text x={AM.x} y={AM.y + 1} fontSize="26" fill={C.ink} textAnchor="middle" dominantBaseline="central">
        A
      </text>
      <g transform={`translate(${AM.x - AM.r - 74} ${AM.y})`}>
        <rect x="-58" y="-20" width="116" height="40" rx="7" fill="#11161d" />
        <text
          x="0"
          y="1"
          fontSize="22"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fill="#ffffff"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {current.toFixed(2)} A
        </text>
      </g>
    </g>
  );
}

function FixedResistor({ ohms }) {
  return (
    <g>
      <rect
        x={RES.x - RES.w / 2}
        y={BOT - RES.h / 2}
        width={RES.w}
        height={RES.h}
        fill="#fff"
        stroke={C.greenDark}
        strokeWidth="3"
      />
      <text x={RES.x} y={BOT + 1} fontSize="20" fill={C.ink} textAnchor="middle" dominantBaseline="central">
        {fmtNum(ohms)} Ω
      </text>
    </g>
  );
}

function Voltmeter({ reading }) {
  return (
    <g>
      <circle cx={VM.left} cy={BOT} r="4.5" fill={C.ink} />
      <circle cx={VM.right} cy={BOT} r="4.5" fill={C.ink} />
      <circle cx={VM.x} cy={VM.y} r={VM.r} fill="#fff" stroke={C.ink} strokeWidth="2.6" />
      <text x={VM.x} y={VM.y + 1} fontSize="26" fill={C.ink} textAnchor="middle" dominantBaseline="central">
        V
      </text>
      <g transform={`translate(${VM.x} ${VM.y + 62})`}>
        <rect x="-58" y="-20" width="116" height="40" rx="7" fill="#11161d" />
        <text
          x="0"
          y="1"
          fontSize="22"
          fontFamily="ui-monospace, Menlo, Consolas, monospace"
          fill="#ffffff"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {fmtV(reading)} V
        </text>
      </g>
    </g>
  );
}

/* ---------------- Theory panel ---------------- */

function Theory({ onClose, returnFocusRef, volts, vLdr }) {
  const closeRef = useRef(null);

  // Focus the close button on open; give focus back to the theory
  // button on close. Stop the page behind from scrolling meanwhile.
  useEffect(() => {
    const returnTo = returnFocusRef.current;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      returnTo?.focus();
    };
  }, [returnFocusRef]);

  // The close button is the only control, so Tab stays on it
  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <div
      className="theoryBackdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="theoryPanel" role="dialog" aria-modal="true" aria-labelledby="theoryTitle" onKeyDown={onKeyDown}>
        <header className="theoryHead">
          <h2 id="theoryTitle">Theory</h2>
          <button ref={closeRef} className="theoryClose" onClick={onClose} aria-label="Close theory">
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </header>

        <div className="theoryBody">
          <section>
            <h3>Light-dependent resistor (LDR)</h3>
            <p>
              The resistance of a LDR depends on light intensity. At low light levels, the LDR has a
              high resistance. As the light intensity increases, the resistance decreases. A LDR can
              be used as a sensor in cameras or automatic lights that come on when it gets dark.{" "}
              <span className="cite">[BBC Bitesize]</span>
            </p>
          </section>

          <section>
            <h3>Voltage in series circuits</h3>
            <p>
              The potential difference (voltage) supplied by the battery is shared between components
              in the circuit, in proportion to their resistance.
            </p>
            <p>In this case:</p>
            <div className="theoryEq">
              <div>
                <i>V</i>
                <sub>battery</sub> = <i>V</i>
                <sub>LDR</sub> + <i>V</i>
                <sub>fixed resistor</sub>
              </div>
              <div className="theoryNow">
                <span className="nowLabel">Right now</span>
                <span>
                  <Num w={4}>{fmtNum(volts)}</Num> V = <Num w={5}>{fmtV(vLdr)}</Num> V +{" "}
                  <Num w={5}>{fmtV(volts - vLdr)}</Num> V
                </span>
              </div>
            </div>
            <p>
              A larger LDR resistance will mean a larger proportion of the battery’s voltage is
              dropped across the LDR.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* A number in a fixed-width slot, so the rest of the equation stays
   still while the values change. */
function Num({ w, align = "right", children }) {
  return (
    <span className="num" style={{ width: `${w}ch`, textAlign: align }}>
      {children}
    </span>
  );
}

/* ---------------- Slider ---------------- */

function Slider({ id, label, value, min, max, step, onChange, display, accent }) {
  return (
    <div className="control">
      <label htmlFor={id}>
        <span>{label}</span>
        <strong>{display}</strong>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          "--fill": accent,
          "--pct": `${((value - min) / (max - min)) * 100}%`,
        }}
      />
    </div>
  );
}

// Places a control in the scene, next to the part it changes
function SceneCtl({ at, children }) {
  const style = {
    left: `${((at.x - VB.x) / VB.w) * 100}%`,
    top: `${((at.y - VB.y) / VB.h) * 100}%`,
    width: `${(at.w / VB.w) * 100}%`,
  };
  return (
    <div className="sceneCtl" style={style}>
      {children}
    </div>
  );
}

/* ---------------- App ---------------- */

export default function App() {
  const [light, setLight] = useState(3.88);
  const [volts, setVolts] = useState(12);
  const [rFixed, setRFixed] = useState(5);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [graphCollapsed, setGraphCollapsed] = useState(true);
  const [eqCollapsed, setEqCollapsed] = useState(true);
  const [maximised, setMaximised] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const cardRef = useRef(null);
  const svgRef = useRef(null);
  const theoryBtnRef = useRef(null);
  const theoryRef = useRef(theoryOpen);
  useEffect(() => {
    theoryRef.current = theoryOpen;
  }, [theoryOpen]);

  const rLdr = ldrResistance(light);
  const rTotal = rLdr + rFixed;
  const current = volts / rTotal;
  const vLdr = volts * (rLdr / rTotal);

  // The dashes show the size of the current by their speed: a crawl at
  // tiny currents, levelling off at high currents so they never blur.
  const flowSpeed = (140 * current) / (current + 1.5);
  // They stay fully visible, and only fade once the circuit's total
  // resistance gets very high (from 80 Ω up to the ~175 Ω maximum).
  const R_TOTAL_MAX = R_DARK + 30;
  const fadeT = Math.min(1, Math.max(0, (rTotal - 80) / (R_TOTAL_MAX - 80)));
  const flowOpacity = 1 - 0.65 * fadeT;
  useFlowOffset(svgRef, flowSpeed, reduceMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Maximise: real full screen where the browser allows it, a CSS
  // full-window overlay otherwise. Esc closes the theory first.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setMaximised(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (theoryRef.current) setTheoryOpen(false);
      else setMaximised(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleMaximise = () => {
    if (maximised) {
      setMaximised(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }
    setMaximised(true);
    const el = cardRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* not allowed here: the CSS overlay is used instead */
      });
    }
  };

  return (
    <main className="page">
      <style>{styles}</style>
      <div className="shell">
        <BrandLogo className="page-logo" />
        <header className="heading">
          <div className="eyebrow">Electricity • Resistance</div>
          <h1>Light-dependent resistor (LDR)</h1>
          <p className="intro">
            Change the light level and watch the LDR’s resistance, the current and the voltmeter
            reading respond. The battery’s voltage is shared between the LDR and the fixed resistor.
          </p>
        </header>

        <section ref={cardRef} className={`card${maximised ? " max" : ""}`}>
          <div className="topButtons">
            <button
              ref={theoryBtnRef}
              className="theoryBtn"
              onClick={() => setTheoryOpen(true)}
              aria-haspopup="dialog"
            >
              Click here for theory
            </button>
            <button
              className="maxBtn"
              onClick={toggleMaximise}
              aria-label={maximised ? "Exit full screen" : "Full screen"}
              title={maximised ? "Exit full screen (Esc)" : "Full screen"}
            >
              {maximised ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />
                </svg>
              )}
            </button>
          </div>

          <div className="stage">
            <div className="sceneBox">
            <div className="scene">
            <svg
              ref={svgRef}
              viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
              role="img"
              aria-label={`Lamp shining on an LDR in series with a ${fmtNum(rFixed)} ohm resistor and a ${fmtNum(volts)} volt battery. The LDR has a resistance of ${fmtR(rLdr)} ohms and the voltmeter reads ${fmtV(vLdr)} volts.`}
              style={{ "--flow-opacity": flowOpacity }}
            >
              <defs>
                <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={C.beam} stopOpacity="1" />
                  <stop offset="1" stopColor={C.beam} stopOpacity="0.55" />
                </linearGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={C.ink} />
                </marker>
              </defs>

              <Graph
                light={light}
                rLdr={rLdr}
                collapsed={graphCollapsed}
                onToggle={() => setGraphCollapsed((v) => !v)}
              />
              <Lamp light={light} />

              {WIRES.map((d) => (
                <Wire key={d} d={d} />
              ))}
              <Battery />
              <LdrSymbol light={light} />
              <FixedResistor ohms={rFixed} />
              <Voltmeter reading={vLdr} />
              {/* The lamp's light falls across the LDR and the voltmeter */}
              <defs>
                <clipPath id="ldrClip">
                  <circle cx={LDR.x} cy={LDR.y} r={LDR.r + 1.5} />
                  <circle cx={VM.x} cy={VM.y} r={VM.r + 1.5} />
                </clipPath>
              </defs>
              <g clipPath="url(#ldrClip)">
                <Beam opacity={beamOpacityAt(light)} />
              </g>
              <Ammeter current={current} />

              {/* Current animation overlay, on top of the wires */}
              {FLOW_PATHS.map((d) => (
                <FlowOverlay key={d} d={d} />
              ))}
            </svg>

            <div className="sceneCtls">
              <SceneCtl at={CTL.light}>
                <Slider
                  id="light"
                  label="Light level"
                  display={null}
                  value={light}
                  min={0}
                  max={LIGHT_MAX}
                  step={0.01}
                  onChange={setLight}
                  accent={C.amber}
                />
              </SceneCtl>
              <SceneCtl at={CTL.battery}>
                <Slider
                  id="battery"
                  label="Battery"
                  display={`${fmtNum(volts)} V`}
                  value={volts}
                  min={1}
                  max={12}
                  step={0.5}
                  onChange={setVolts}
                  accent="#3867a8"
                />
              </SceneCtl>
              <SceneCtl at={CTL.fixed}>
                <Slider
                  id="fixed"
                  label="Fixed resistor"
                  display={`${fmtNum(rFixed)} Ω`}
                  value={rFixed}
                  min={1}
                  max={30}
                  step={1}
                  onChange={setRFixed}
                  accent={C.green}
                />
              </SceneCtl>
            </div>
            </div>
            </div>


            {theoryOpen && (
              <Theory
                onClose={() => setTheoryOpen(false)}
                returnFocusRef={theoryBtnRef}
                volts={volts}
                vLdr={vLdr}
              />
            )}
          </div>

          <div className={`equation${eqCollapsed ? " collapsed" : ""}`} aria-live="polite">
            <button
              className="miniBtn"
              onClick={() => setEqCollapsed((v) => !v)}
              aria-expanded={!eqCollapsed}
              aria-label={eqCollapsed ? "Show the equation" : "Minimise the equation"}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d={eqCollapsed ? "M1 6h10M6 1v10" : "M1 6h10"} />
              </svg>
            </button>
            {eqCollapsed ? (
              <div className="eqTitle">Voltage across the LDR - calculations</div>
            ) : (
              <div className="eqRow">
                <span>
                  V<sub>LDR</sub> = V<sub>battery</sub> ×
                </span>
                <span className="frac">
                  <span>
                    R<sub>LDR</sub>
                  </span>
                  <span>
                    R<sub>LDR</sub> + R<sub>fixed</sub>
                  </span>
                </span>
                <span>
                  = <Num w={4}>{fmtNum(volts)}</Num> ×
                </span>
                <span className="frac">
                  <span>
                    <Num w={5} align="center">
                      {fmtR(rLdr)}
                    </Num>
                  </span>
                  <span>
                    <Num w={5}>{fmtR(rLdr)}</Num> + <Num w={2} align="left">{fmtNum(rFixed)}</Num>
                  </span>
                </span>
                <span>
                  ={" "}
                  <strong>
                    <Num w={5}>{fmtV(vLdr)}</Num> V
                  </strong>
                </span>
              </div>
            )}
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

/* ---------------- Styles ---------------- */

const styles = `
  * { box-sizing: border-box; }
  button, input { outline: none; }
  button::-moz-focus-inner { border: 0; }
  button:focus-visible, input:focus-visible {
    outline: 2px solid #2166d1;
    outline-offset: 2px;
    border-radius: 4px;
  }
  html, body, #root {
    margin: 0;
    width: 100%;
    min-height: 100%;
    background: #f3f5f7;
  }
  body { overflow-x: hidden; }
  button { font: inherit; }

  .page {
    min-height: 100vh;
    padding: 24px 16px;
    background: #f3f5f7;
    color: ${C.ink};
    font-family: Inter, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .shell { max-width: 1160px; margin: 0 auto; }
  .heading { margin-bottom: 18px; text-align: center; }
  .eyebrow {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #3867a8;
    margin-bottom: 4px;
  }
  .heading h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.1;
    letter-spacing: -.04em;
  }
  .intro {
    max-width: 780px;
    margin: 8px auto 0;
    color: ${C.muted};
    line-height: 1.5;
    font-size: 14px;
  }

  .card {
    position: relative;
    background: #fff;
    border: 1px solid #d9dee4;
    border-radius: 18px;
    box-shadow: 0 10px 28px rgba(31, 41, 55, .07);
    overflow: hidden;
  }
  .topButtons {
    position: absolute;
    top: 10px;
    right: 12px;
    z-index: 3;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .theoryBtn {
    border: 0;
    border-radius: 6px;
    background: #e5604c;
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    padding: 7px 14px;
    cursor: pointer;
  }
  .theoryBtn:hover { background: #d14b37; }
  .maxBtn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d9dee4;
    border-radius: 8px;
    background: #fff;
    color: ${C.ink};
    cursor: pointer;
  }
  .maxBtn:hover { background: #eef1f5; }

  .card.max {
    position: fixed;
    inset: 0;
    z-index: 1000;
    border-radius: 0;
    border: 0;
    display: flex;
    flex-direction: column;
  }
  .card.max .stage {
    flex: 1;
    min-height: 0;
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
  }
  /* Full screen: the scene is as large as fits, keeping its shape */
  .card.max .sceneBox {
    container-type: size;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card.max .scene {
    width: min(100cqw, calc(100cqh * ${VB.w} / ${VB.h}));
    max-width: none;
  }

  .stage {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    align-items: center;
    padding: 58px 22px 6px;
  }
  .sceneBox { min-width: 0; }
  .scene {
    position: relative;
    width: 100%;
    max-width: 998px;
    margin: 0 auto;
    container: scene / inline-size;
  }
  .scene svg { display: block; width: 100%; height: auto; }

  .sceneCtls { position: absolute; inset: 0; pointer-events: none; }
  .sceneCtl {
    position: absolute;
    transform: translateX(-50%);
    pointer-events: auto;
    font-size: clamp(12px, 1.9cqw, 16px);
  }
  /* Small screens: the sliders move under the drawing */
  @container scene (max-width: 600px) {
    .sceneCtls {
      position: static;
      display: grid;
      gap: 12px;
      padding: 12px 4px 0;
    }
    .sceneCtl {
      position: static;
      transform: none;
      width: auto !important;
      font-size: 15px;
    }
  }



  /* The uses-of-electromagnets current overlay: 5 on, 7 off, red.
     The offset is advanced from JavaScript so the speed can follow
     the current. */
  .gBtn { cursor: pointer; outline: none; }
  .gBtn:hover rect { fill: #eef1f5; }
  .gBtn:focus-visible rect { stroke: #2166d1; stroke-width: 2; }

  .ldr-flow {
    stroke-dasharray: 5 7;
    stroke-dashoffset: var(--flow-offset, 0);
    opacity: var(--flow-opacity, 1);
  }

  .control label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    /* The label may be wider than a short slider: keep it on one line,
       centred over the slider */
    white-space: nowrap;
    width: max-content;
    min-width: 100%;
    margin-left: 50%;
    transform: translateX(-50%);
    margin-bottom: 2px;
    color: ${C.ink};
  }
  .control strong { font-variant-numeric: tabular-nums; }
  /* Sliders: each has its own colour to the left of the thumb and
     black to the right. --fill and --pct are set per slider. */
  .control input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: 100%;
    height: 22px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .control input[type="range"]::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, var(--fill) 0 var(--pct), ${C.ink} var(--pct) 100%);
  }
  .control input[type="range"]::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: ${C.ink};
  }
  .control input[type="range"]::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--fill);
  }
  .control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -7px;
    border-radius: 50%;
    background: var(--fill);
    border: 2px solid #fff;
    box-shadow: 0 0 0 1.5px ${C.ink};
  }
  .control input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--fill);
    border: 2px solid #fff;
    box-shadow: 0 0 0 1.5px ${C.ink};
  }

  .equation {
    position: relative;
    margin: 12px 18px 18px;
    padding: 14px 18px;
    background: #fbf8f5;
    border: 1px solid #efe6dc;
    border-radius: 12px;
    font-size: 19px;
    font-variant-numeric: tabular-nums;
  }
  .equation.collapsed { padding-block: 10px; }
  .eqTitle {
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #3867a8;
    line-height: 26px;
  }
  .miniBtn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid #d9dee4;
    border-radius: 6px;
    background: #fff;
    color: ${C.ink};
    cursor: pointer;
  }
  .miniBtn:hover { background: #eef1f5; }
  .eqRow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .eqRow.small {
    margin-top: 10px;
    font-size: 15px;
    color: ${C.muted};
  }
  .num {
    display: inline-block;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .frac {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.25;
  }
  .frac > span:first-child {
    border-bottom: 1.5px solid ${C.ink};
    padding: 0 4px 2px;
    width: 100%;
    text-align: center;
  }
  .frac > span:last-child { padding: 2px 4px 0; }

  /* Theory: a dialog over a dimmed page. Fixed, so it also works when
     the card is full screen. */
  .theoryBackdrop {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: rgba(17, 22, 29, .45);
    animation: theoryFade .15s ease-out;
  }
  .theoryPanel {
    width: 100%;
    max-width: 680px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(17, 22, 29, .28);
    overflow: hidden;
    animation: theoryRise .18s ease-out;
  }
  .theoryHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 14px 24px;
    border-bottom: 1px solid #e5e8ec;
  }
  .theoryHead h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #3867a8;
  }
  .theoryClose {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d9dee4;
    border-radius: 8px;
    background: #fff;
    color: ${C.ink};
    cursor: pointer;
  }
  .theoryClose:hover { background: #eef1f5; }
  .theoryBody {
    overflow: auto;
    padding: 20px 24px 8px;
    font-size: 17px;
    line-height: 1.55;
    color: ${C.ink};
  }
  .theoryBody section { margin-bottom: 18px; }
  .theoryBody h3 {
    margin: 0 0 6px;
    font-size: 20px;
    letter-spacing: -.01em;
    text-wrap: balance;
  }
  .theoryBody p { margin: 0 0 12px; max-width: 62ch; }
  .theoryBody .cite { color: ${C.muted}; }
  .theoryEq {
    margin: 4px 0 14px;
    padding: 12px 16px;
    border-radius: 10px;
    background: #fbf8f5;
    border: 1px solid #efe6dc;
    font-size: 20px;
  }
  .theoryNow {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-top: 6px;
    font-size: 17px;
    color: ${C.muted};
    font-variant-numeric: tabular-nums;
  }
  .nowLabel {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .theoryEq > div:first-child { white-space: nowrap; }
  @media (max-width: 480px) {
    .theoryEq { font-size: 16px; padding: 10px 12px; }
    .theoryBody { padding: 16px 18px 4px; font-size: 16px; }
  }
  @keyframes theoryFade { from { opacity: 0; } }
  @keyframes theoryRise { from { opacity: 0; transform: translateY(8px); } }
  @media (prefers-reduced-motion: reduce) {
    .theoryBackdrop, .theoryPanel { animation: none; }
  }

  @media (max-width: 720px) {
    .equation { font-size: 15px; margin: 10px 12px 14px; padding: 12px; }
    .theoryBtn { font-size: 13px; padding: 6px 10px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ldr-flow { stroke-dashoffset: 0; }
  }
`;
