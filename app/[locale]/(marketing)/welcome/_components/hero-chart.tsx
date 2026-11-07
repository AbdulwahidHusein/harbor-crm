import { buoys, contours, course, harborMouth, islet, isletRings, land, soundings } from "./chart-geometry";
import s from "../welcome.module.css";

/**
 * The hero chart. Customers are buoys: port red needs attention, starboard
 * green is on course. Today's course is plotted from the harbor mouth through
 * the three priorities, in order. Pure SVG + CSS; motion is disabled for
 * reduced-motion users.
 */
export function HeroChart() {
  return (
    <svg viewBox="0 0 900 720" className="h-full w-full" role="img" aria-labelledby="chart-title chart-desc">
      <title id="chart-title">Your customers, charted</title>
      <desc id="chart-desc">
        A nautical chart where each customer is a buoy. Acme Corp, Globex and Initech are marked red and connected by
        today&apos;s course; Umbrella, Hooli and Stark Industries are green.
      </desc>

      {/* Shallow water band near the coast */}
      <path d={contours[1]} fill="var(--depth)" className={s.fade} style={{ animationDelay: "0.2s" }} />
      <path d={contours[0]} fill="#c9dae3" className={s.fade} style={{ animationDelay: "0.3s" }} />

      {/* Depth contours */}
      <g fill="none" stroke="var(--ink)" strokeOpacity="0.28" strokeWidth="1">
        {contours.map((d, i) => (
          <path key={i} d={d} pathLength={1} className={s.contour} style={{ animationDelay: `${0.08 * i}s` }} />
        ))}
        {isletRings.map((d, i) => (
          <path key={`i${i}`} d={d} pathLength={1} className={s.contour} style={{ animationDelay: `${0.3 + 0.1 * i}s` }} />
        ))}
      </g>

      {/* Land */}
      <g className={s.fade} style={{ animationDelay: "0.1s" }}>
        <path d={land} fill="var(--land)" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="1.2" />
        <path d={islet} fill="var(--land)" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="1.2" />
        {/* Piers marking the harbor mouth */}
        <path
          d={`M${harborMouth[0] - 26},${harborMouth[1] - 58} l6,52 M${harborMouth[0] + 30},${harborMouth[1] - 60} l-4,54`}
          stroke="var(--ink)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <text x={740} y={70} textAnchor="middle" className={`${s.label} ${s.chartLabel}`} fill="var(--ink)" fontSize="15" opacity="0.7">
          Harbor
        </text>
      </g>

      {/* Soundings */}
      <g className={`${s.fade} ${s.chartLabel}`} style={{ animationDelay: "0.6s" }}>
        {soundings.map((p) => (
          <text key={`${p.x}-${p.y}`} x={p.x} y={p.y} className={s.sounding} fontSize="15" fill="var(--ink)" opacity="0.5" textAnchor="middle">
            {p.d}
          </text>
        ))}
      </g>

      {/* Today's course */}
      <path d={course} fill="none" stroke="var(--harbor)" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.35" />
      <path d={course} fill="none" stroke="var(--harbor)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className={s.course} />

      {/* Buoys */}
      {buoys.map((b, i) => {
        const color = b.tone === "port" ? "var(--port)" : "var(--starboard)";
        return (
          <g key={b.id} className={s.buoy} style={{ animationDelay: `${1.05 + i * 0.09}s` }}>
            {b.order === 1 ? <circle cx={b.x} cy={b.y} r={11} fill="var(--port)" className={s.pulse} /> : null}
            <circle cx={b.x} cy={b.y} r={b.order ? 11 : 8} fill={color} stroke="var(--paper)" strokeWidth="3" />
            {b.order ? (
              <text x={b.x} y={b.y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff" className={s.label}>
                {b.order}
              </text>
            ) : null}
            <g className={s.chartLabel}>
              <text x={b.x + 18} y={b.y - 2} className={s.label} fontSize="15" fill="var(--ink)" stroke="var(--paper)" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">
                {b.label}
              </text>
              <text x={b.x + 18} y={b.y + 15} className={s.sounding} fontSize="14" fill={color} stroke="var(--paper)" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">
                {b.note}
              </text>
            </g>
          </g>
        );
      })}

      {/* Compass */}
      <g transform="translate(92 640)" className={`${s.fade} ${s.chartLabel}`} style={{ animationDelay: "0.8s" }} stroke="var(--ink)" strokeOpacity="0.45" fill="none">
        <circle r="34" />
        <circle r="26" strokeDasharray="1.5 4" />
        <path d="M0,-44 L5,0 L0,44 L-5,0 Z" fill="var(--ink)" fillOpacity="0.55" stroke="none" />
        <text y="-50" textAnchor="middle" fontSize="12" fill="var(--ink)" stroke="none" className={s.label} opacity="0.7">
          N
        </text>
      </g>
    </svg>
  );
}
