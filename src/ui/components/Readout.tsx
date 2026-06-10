/**
 * Readout — the signature element (SPEC §10): mono value, small-caps unit,
 * hairline underline, 200 ms count-up on change, click → provenance popover
 * (model name@version, input hash, timestamp). Respects
 * prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';

export interface ReadoutProvenance {
  modelVersions: Record<string, string>;
  inputHash: string;
  timestamp: string;
}

interface ReadoutProps {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  provenance?: ReadoutProvenance;
}

function useCountUp(target: number, durationMs = 200): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !Number.isFinite(target)) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    fromRef.current = target;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setDisplay(from + (target - from) * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return display;
}

export function Readout({ label, value, unit, decimals = 1, provenance }: ReadoutProps) {
  const display = useCountUp(value);
  const [open, setOpen] = useState(false);
  const text = Number.isFinite(display) ? display.toFixed(decimals) : '—';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => provenance && setOpen((o) => !o)}
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: 'var(--trace)', cursor: provenance ? 'pointer' : 'default' }}
        aria-expanded={open}
      >
        <div className="text-xs uppercase tracking-wider opacity-60">{label}</div>
        <div
          className="border-b pb-0.5"
          style={{ borderColor: 'var(--line)', borderBottomWidth: 1 }}
        >
          <span
            className="text-2xl"
            style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
          >
            {text}
          </span>{' '}
          <span className="text-sm opacity-70" style={{ fontVariant: 'small-caps' }}>
            {unit}
          </span>
        </div>
      </button>
      {open && provenance && (
        <div
          role="dialog"
          aria-label={`${label} provenance`}
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded border bg-panel p-3 text-xs shadow-lg"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="mb-1 font-semibold uppercase tracking-wider opacity-60">
            Provenance
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            {Object.entries(provenance.modelVersions).map(([name, version]) => (
              <div key={name}>
                {name}@{version}
              </div>
            ))}
          </div>
          <div className="mt-2 opacity-70" style={{ fontFamily: 'var(--font-mono)' }}>
            hash {provenance.inputHash.slice(0, 16)}…
          </div>
          <div className="opacity-70">{new Date(provenance.timestamp).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
