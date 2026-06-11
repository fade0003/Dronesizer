/**
 * Trade-space view — SPEC §10: study setup, streamed DOE progress, Pareto
 * scatter with selectable axes, click → config drawer with "open in
 * Builder" (≤ 2 clicks to the exact component list with costs).
 */
import { lazy, Suspense } from 'react';
import { useConfigStore } from '../state/configStore';
import { useAppStore } from '../state/appStore';
import {
  METRIC_AXES,
  useTradespaceStore,
} from '../state/tradespaceStore';

const TradeSpacePlot = lazy(() => import('../components/TradeSpacePlot'));

export function TradeSpaceView() {
  const { configurations, components, componentsById, activeId } = useConfigStore();
  const setView = useAppStore((s) => s.setView);
  const ts = useTradespaceStore();
  const active = configurations.find((c) => c.id === activeId);
  const selected = ts.cases.find((c) => c.index === ts.selectedIndex) ?? null;

  const axisLabel = (key: string) =>
    METRIC_AXES.find((a) => a.key === key)?.label ?? key;

  return (
    <div className="flex flex-wrap gap-6">
      <div className="min-w-0 flex-1" style={{ minWidth: 480 }}>
        {/* Study setup */}
        <div
          className="mb-4 rounded border bg-panel p-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="mb-2 text-xs uppercase tracking-wider opacity-60">
            DOE study — Latin hypercube on {active?.name ?? '—'}
            <span className="ml-2 normal-case opacity-70">
              (base mission: camera run; variables override it per case)
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {ts.variables.map((v) => (
              <fieldset key={v.path} className="text-xs">
                <label className="mb-1 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={v.enabled}
                    onChange={(e) =>
                      ts.setVariable(v.path, { enabled: e.target.checked })
                    }
                  />
                  {v.label}
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    aria-label={`${v.label} min`}
                    value={v.min}
                    disabled={!v.enabled}
                    onChange={(e) =>
                      ts.setVariable(v.path, { min: Number(e.target.value) })
                    }
                    className="w-20 rounded border bg-panel px-1 py-0.5 disabled:opacity-40"
                    style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}
                  />
                  <input
                    type="number"
                    aria-label={`${v.label} max`}
                    value={v.max}
                    disabled={!v.enabled}
                    onChange={(e) =>
                      ts.setVariable(v.path, { max: Number(e.target.value) })
                    }
                    className="w-20 rounded border bg-panel px-1 py-0.5 disabled:opacity-40"
                    style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </fieldset>
            ))}
            <label className="text-xs">
              <span className="mb-1 block">Cases (50–1000)</span>
              <input
                type="number"
                min={50}
                max={1000}
                value={ts.nCases}
                onChange={(e) => ts.setNCases(Number(e.target.value))}
                className="w-24 rounded border bg-panel px-1 py-0.5"
                style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}
              />
            </label>
            <button
              type="button"
              disabled={!active || ts.running}
              onClick={() => active && void ts.runStudy(active, components)}
              className="rounded px-6 py-2 font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--signal)', fontFamily: 'var(--font-display)' }}
            >
              {ts.running ? 'Running…' : 'Run study'}
            </button>
          </div>
          {(ts.running || ts.cases.length > 0) && (
            <div className="mt-3 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
              <div
                className="mb-1 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: 'var(--line)' }}
                role="progressbar"
                aria-valuenow={ts.progress.done}
                aria-valuemax={ts.progress.total}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${ts.progress.total ? (100 * ts.progress.done) / ts.progress.total : 0}%`,
                    background: 'var(--trace)',
                  }}
                />
              </div>
              {ts.progress.done}/{ts.progress.total} cases
              {ts.progress.cacheHits > 0 && ` · ${ts.progress.cacheHits} from cache`}
              {ts.elapsedMs !== null && ` · solver ${(ts.elapsedMs / 1000).toFixed(2)} s`}
              {' · '}
              {ts.cases.filter((c) => c.status === 'converged').length} converged,{' '}
              {ts.cases.filter((c) => c.status === 'invalid').length} invalid,{' '}
              {ts.cases.filter((c) => c.status === 'diverged').length} diverged
            </div>
          )}
        </div>

        {/* Axes + plot */}
        {ts.cases.length > 0 && (
          <>
            <div className="mb-2 flex gap-4 text-sm">
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  <span className="mr-1 text-xs uppercase opacity-60">{axis}</span>
                  <select
                    value={axis === 'x' ? ts.xKey : ts.yKey}
                    onChange={(e) =>
                      axis === 'x'
                        ? ts.setAxes(e.target.value, ts.yKey)
                        : ts.setAxes(ts.xKey, e.target.value)
                    }
                    className="rounded border bg-panel px-2 py-1"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {METRIC_AXES.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label} ({a.better})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="rounded border bg-panel p-2" style={{ borderColor: 'var(--line)' }}>
              <Suspense fallback={<p className="p-8 text-sm opacity-60">Loading plot…</p>}>
                <TradeSpacePlot
                  cases={ts.cases}
                  paretoIndices={ts.paretoIds()}
                  xKey={ts.xKey}
                  xLabel={axisLabel(ts.xKey)}
                  yKey={ts.yKey}
                  yLabel={axisLabel(ts.yKey)}
                  onSelectCase={ts.select}
                />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* Config drawer */}
      {selected && active && (
        <aside
          className="w-80 shrink-0 self-start rounded border bg-panel p-4"
          style={{ borderColor: 'var(--line)' }}
          aria-label="Case detail"
        >
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider opacity-60">
              Case {selected.index} — {selected.status}
            </span>
            <button
              type="button"
              onClick={() => ts.select(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              close
            </button>
          </div>
          <div className="mb-3 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {Object.entries(selected.inputVector).map(([k, v]) => (
              <div key={k}>
                {k} = {v.toFixed(1)}
              </div>
            ))}
            <div className="mt-1 opacity-60">hash {selected.inputHash.slice(0, 12)}…</div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {METRIC_AXES.filter((a) => selected.metrics[a.key] !== undefined).map((a) => (
              <div key={a.key}>
                <span className="opacity-60">{a.key}</span>{' '}
                {selected.metrics[a.key]!.toFixed(2)}
              </div>
            ))}
          </div>
          <div className="mb-2 text-xs uppercase tracking-wider opacity-60">
            Components ({active.name})
          </div>
          <table className="w-full text-xs">
            <tbody>
              {active.instances.map((inst) => {
                const c = componentsById.get(inst.componentId);
                return (
                  <tr key={`${inst.role}:${inst.componentId}`}>
                    <td className="py-0.5 pr-2 opacity-60">{inst.role}</td>
                    <td className="py-0.5">{c?.model} ×{inst.count}</td>
                    <td className="py-0.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                      ${((c?.unitCostUsd ?? 0) * inst.count).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => setView('builder')}
            className="mt-3 w-full rounded border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--trace)', color: 'var(--trace)' }}
          >
            Open in Builder
          </button>
        </aside>
      )}
    </div>
  );
}
