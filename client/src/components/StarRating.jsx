import { useState } from 'react';

const STAR_PATH =
  'M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z';

const SIZES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

function Star({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d={STAR_PATH} />
    </svg>
  );
}

/**
 * Read-only display: renders a grey row of stars with a clipped gold row on top,
 * so 3.6 stars actually looks like 3.6 stars.
 */
function StarDisplay({ value, size, max }) {
  const clamped = Math.max(0, Math.min(max, Number(value) || 0));
  const pct = (clamped / max) * 100;
  const starClass = `${SIZES[size]} shrink-0`;

  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span className="flex flex-nowrap gap-0.5 text-slate-200">
        {Array.from({ length: max }, (_, i) => (
          <Star key={i} className={starClass} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex flex-nowrap gap-0.5 overflow-hidden text-amber-400"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: max }, (_, i) => (
          <Star key={i} className={starClass} />
        ))}
      </span>
    </span>
  );
}

/** Clickable 1–max picker used by ReviewForm. */
function StarInput({ value, onChange, size, max, name, label }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <span
      className="inline-flex flex-nowrap gap-1"
      role="radiogroup"
      aria-label={label || name}
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: max }, (_, i) => {
        const score = i + 1;
        const on = score <= active;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} out of ${max}`}
            className={`rounded transition-transform duration-100 hover:scale-110 ${
              on ? 'text-amber-400' : 'text-slate-300'
            }`}
            onMouseEnter={() => setHovered(score)}
            onFocus={() => setHovered(score)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange(score)}
          >
            <Star className={SIZES[size]} />
          </button>
        );
      })}
    </span>
  );
}

/**
 * <StarRating value={4.2} />                        read-only
 * <StarRating value={n} onChange={fn} interactive />  picker
 */
export default function StarRating({
  value = 0,
  onChange,
  interactive = false,
  size = 'sm',
  max = 5,
  showValue = false,
  name,
  label,
  className = '',
}) {
  const numeric = Number(value) || 0;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {interactive ? (
        <StarInput
          value={numeric}
          onChange={onChange}
          size={size}
          max={max}
          name={name}
          label={label}
        />
      ) : (
        <StarDisplay value={numeric} size={size} max={max} />
      )}
      {showValue && (
        <span className="text-sm font-semibold tabular-nums text-slate-700">
          {numeric ? numeric.toFixed(1) : '—'}
        </span>
      )}
      {!interactive && (
        <span className="sr-only">{numeric ? `${numeric.toFixed(1)} out of ${max}` : 'Not yet rated'}</span>
      )}
    </span>
  );
}
