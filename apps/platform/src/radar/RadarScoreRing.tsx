export function scoreHue(score: number) {
  if (score >= 80) return { text: 'var(--color-success)', ring: 'var(--color-success)' };
  if (score >= 60) return { text: 'var(--color-text)', ring: 'var(--color-border)' };
  return { text: 'var(--color-warning)', ring: 'var(--color-warning)' };
}

export function ScorePill({ value, max = 100 }: { value: number | null | undefined; max?: number }) {
  const v = value ?? 0;
  const pct = max === 10 ? v * 10 : v;
  const { text } = scoreHue(pct);
  return <span style={{ color: text }} className="font-mono text-[11px] font-medium tabular-nums">{max === 10 ? `${v}/10` : v}</span>;
}

export function LeadScoreRing({ score, size = 44 }: { score: number | null | undefined; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const s = score ?? 0;
  const { ring, text } = scoreHue(s);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-surface-hover)" strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={ring} strokeWidth="3" fill="none"
          strokeDasharray={`${(s / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ color: text }} className="text-[10px] font-mono font-semibold tabular-nums">{s}</span>
      </div>
    </div>
  );
}
