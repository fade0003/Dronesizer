/** Catalog view — filterable table, class chips, cost column (SPEC §10). */
import { useMemo, useState } from 'react';
import type { ComponentClass } from '../../db/schema';
import { useConfigStore } from '../state/configStore';

const CLASSES: (ComponentClass | 'all')[] = [
  'all', 'motor', 'prop', 'battery', 'frame', 'esc', 'fc', 'vtx', 'payload',
];

function paramSummary(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => typeof v === 'number')
    .slice(0, 4)
    .map(([k, v]) => `${k} ${v as number}`)
    .join(' · ');
}

export function CatalogView() {
  const { components, addInstance, activeId } = useConfigStore();
  const [cls, setCls] = useState<ComponentClass | 'all'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return components
      .filter((c) => cls === 'all' || c.cls === cls)
      .filter(
        (c) =>
          q === '' ||
          `${c.mfr} ${c.model}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.cls.localeCompare(b.cls) || a.unitCostUsd - b.unitCostUsd);
  }, [components, cls, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCls(c)}
            className="rounded-full border px-3 py-1 text-xs uppercase tracking-wider"
            style={{
              borderColor: cls === c ? 'var(--ink)' : 'var(--line)',
              background: cls === c ? 'var(--ink)' : 'var(--panel)',
              color: cls === c ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            {c}
          </button>
        ))}
        <input
          type="search"
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter catalog"
          className="ml-auto rounded border bg-panel px-3 py-1 text-sm"
          style={{ borderColor: 'var(--line)' }}
        />
      </div>
      <div className="overflow-x-auto rounded border bg-panel" style={{ borderColor: 'var(--line)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider opacity-60" style={{ borderColor: 'var(--line)' }}>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2 text-right">Mass</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2">Key params</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                <td className="px-3 py-2 text-xs uppercase tracking-wider opacity-60">{c.cls}</td>
                <td className="px-3 py-2" title={c.sourceNote}>
                  {c.mfr} <span className="font-medium">{c.model}</span>
                </td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(c.massKg * 1000).toFixed(0)} g
                </td>
                <td className="px-3 py-2 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                  ${c.unitCostUsd.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-xs opacity-70" style={{ fontFamily: 'var(--font-mono)' }}>
                  {paramSummary(c.params)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={!activeId}
                    onClick={() => void addInstance(c.id)}
                    className="rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    Add
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs opacity-60">
        All values representative — verify against manufacturer datasheets before procurement.
      </p>
    </div>
  );
}
