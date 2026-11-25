// client/src/components/Hourglass.tsx
interface Props {
  /** 0 → full top bulb, 1 → all sand fell */
  progress: number;
  running: boolean;
  overtime?: boolean;
  /** changes on every new step → triggers flip animation */
  flipKey: number;
  size?: number;
}

/**
 * SVG hourglass. Top sand level shrinks with progress, bottom pile grows,
 * a thin stream falls while running. Flips 180° whenever `flipKey` changes.
 */
export function Hourglass({ progress, running, overtime = false, flipKey, size = 56 }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const topH = 34 * (1 - p); // sand height in top bulb (max 34)
  const botH = 34 * p;
  const sand = overtime ? 'var(--danger)' : 'url(#sandGrad)';
  return (
    <svg
      key={flipKey}
      className="hourglass flip-in"
      width={size}
      height={size * 1.6}
      viewBox="0 0 60 96"
      role="img"
      aria-label={`Kum saati, %${Math.round(p * 100)} geçti`}
    >
      <defs>
        <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c86b" />
          <stop offset="100%" stopColor="#e0a13a" />
        </linearGradient>
        <clipPath id="topBulb">
          <path d="M10 8 H50 C50 26 34 36 31.5 46 H28.5 C26 36 10 26 10 8 Z" />
        </clipPath>
        <clipPath id="botBulb">
          <path d="M28.5 50 H31.5 C34 60 50 70 50 88 H10 C10 70 26 60 28.5 50 Z" />
        </clipPath>
      </defs>
      {/* frame */}
      <rect x="4" y="2" width="52" height="6" rx="3" className="hg-cap" />
      <rect x="4" y="88" width="52" height="6" rx="3" className="hg-cap" />
      {/* sand */}
      <g clipPath="url(#topBulb)">
        <rect x="0" y={46 - topH} width="60" height={topH} fill={sand} style={{ transition: 'all .5s linear' }} />
      </g>
      <g clipPath="url(#botBulb)">
        <path
          d={`M0 88 L0 ${88 - botH * 0.55} Q30 ${88 - botH * 1.25} 60 ${88 - botH * 0.55} L60 88 Z`}
          fill={sand}
          style={{ transition: 'all .5s linear' }}
        />
      </g>
      {running && p < 1 && <line x1="30" y1="46" x2="30" y2="86" className="hg-stream" stroke={overtime ? 'var(--danger)' : '#e0a13a'} />}
      {/* glass */}
      <path
        d="M10 8 H50 C50 26 34 36 31.5 48 C34 60 50 70 50 88 H10 C10 70 26 60 28.5 48 C26 36 10 26 10 8 Z"
        className="hg-glass"
      />
    </svg>
  );
}
