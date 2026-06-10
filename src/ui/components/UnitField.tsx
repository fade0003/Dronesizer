/**
 * UnitField — numeric input with a unit suffix. Per CLAUDE.md rule 5, any
 * unit conversion in the app lives ONLY here (and in Readout's display):
 * the value prop is always SI; `display` chooses the user-facing unit.
 */
import { useId } from 'react';

type DisplayUnit = 'si' | 'min' | 'inch' | 'kmh';

const CONVERSIONS: Record<DisplayUnit, { toDisplay: number; label?: string }> = {
  si: { toDisplay: 1 },
  min: { toDisplay: 1 / 60, label: 'min' }, // seconds → minutes
  inch: { toDisplay: 1 / 0.0254, label: 'in' }, // metres → inches
  kmh: { toDisplay: 3.6, label: 'km/h' }, // m/s → km/h
};

interface UnitFieldProps {
  label: string;
  /** Value in SI units. */
  value: number;
  unit: string;
  display?: DisplayUnit;
  min?: number;
  max?: number;
  step?: number;
  onChange: (siValue: number) => void;
}

export function UnitField({
  label,
  value,
  unit,
  display = 'si',
  min,
  max,
  step,
  onChange,
}: UnitFieldProps) {
  const id = useId();
  const conv = CONVERSIONS[display];
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <span className="opacity-70">{label}</span>
      <input
        id={id}
        type="number"
        className="w-24 rounded border bg-panel px-2 py-1"
        style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}
        value={Number((value * conv.toDisplay).toPrecision(6))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) / conv.toDisplay)}
      />
      <span className="opacity-60" style={{ fontVariant: 'small-caps' }}>
        {conv.label ?? unit}
      </span>
    </label>
  );
}
