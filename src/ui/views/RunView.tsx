/**
 * Run view — big Run button (signal orange), convergence sparkline,
 * iteration table, divergence explainer card (SPEC §10).
 */
import { useConfigStore } from '../state/configStore';
import { useRunStore } from '../state/runStore';
import { MISSION_PROFILES } from '../missions';
import { Readout } from '../components/Readout';
import { ConvergenceSparkline } from '../components/ConvergenceSparkline';

const METRIC_LAYOUT: { key: string; label: string; unit: string; decimals: number; scale?: number }[] = [
  { key: 'mtowKg', label: 'MTOW', unit: 'kg', decimals: 3 },
  { key: 'mBattKg', label: 'Battery mass', unit: 'kg', decimals: 3 },
  { key: 'battFrac', label: 'Battery fraction', unit: '%', decimals: 1, scale: 100 },
  { key: 'pHoverW', label: 'Hover power', unit: 'W', decimals: 0 },
  { key: 'pCruiseW', label: 'Cruise power', unit: 'W', decimals: 0 },
  { key: 'enduranceMin', label: 'Hover endurance', unit: 'min', decimals: 1 },
  { key: 'enduranceCruiseMin', label: 'Cruise endurance', unit: 'min', decimals: 1 },
  { key: 'vMaxMs', label: 'Max speed', unit: 'm/s', decimals: 1 },
  { key: 'pitchDeg', label: 'Pitch at vMax', unit: 'deg', decimals: 1 },
  { key: 'unitCostUsd', label: 'Unit cost (loaded)', unit: 'usd', decimals: 0 },
  { key: 'bomCostUsd', label: 'BOM cost', unit: 'usd', decimals: 0 },
];

const STATUS_COLOR: Record<string, string> = {
  converged: 'var(--converged)',
  diverged: 'var(--diverged)',
  invalid: 'var(--signal)',
};

export function RunView() {
  const { configurations, componentsById, activeId } = useConfigStore();
  const { missionId, setMission, running, record, run } = useRunStore();
  const active = configurations.find((c) => c.id === activeId);

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wider opacity-60">
            Mission profile
          </span>
          <select
            value={missionId}
            onChange={(e) => setMission(e.target.value)}
            className="rounded border bg-panel px-3 py-2"
            style={{ borderColor: 'var(--line)' }}
          >
            {MISSION_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!active || running}
          onClick={() => active && void run(active, componentsById)}
          className="rounded px-8 py-2 text-lg font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--signal)', fontFamily: 'var(--font-display)' }}
        >
          {running ? 'Running…' : 'Run'}
        </button>
        {active && (
          <span className="text-sm opacity-60">
            on <span className="font-medium">{active.name}</span>
          </span>
        )}
      </div>

      {record && (
        <>
          <div
            className="mb-4 inline-flex items-center gap-2 rounded border px-3 py-1 text-sm"
            style={{
              borderColor: STATUS_COLOR[record.result.status],
              color: STATUS_COLOR[record.result.status],
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: STATUS_COLOR[record.result.status] }}
            />
            {record.result.status} — {record.configName} / {record.missionName}
          </div>

          {record.result.status === 'diverged' && (
            <div
              className="mb-4 max-w-2xl rounded border bg-panel p-4"
              style={{ borderColor: 'var(--diverged)' }}
            >
              <div className="mb-1 font-semibold" style={{ color: 'var(--diverged)' }}>
                This design does not close
              </div>
              <p className="text-sm opacity-80">
                Each iteration, the battery sized for the mission makes the
                vehicle heavier, which raises the power required, which demands
                an even bigger battery — the added energy never catches up with
                the added mass. Shorten the mission, pick a higher
                specific-energy pack, or reduce dry mass.
              </p>
            </div>
          )}

          {record.result.status === 'invalid' && (
            <div
              className="mb-4 max-w-2xl rounded border bg-panel p-4"
              style={{ borderColor: 'var(--signal)' }}
            >
              <div className="mb-1 font-semibold" style={{ color: 'var(--signal)' }}>
                Converged, but outside limits
              </div>
              <ul className="list-disc pl-5 text-sm opacity-80">
                {record.result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(record.result.metrics).length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              {METRIC_LAYOUT.filter((m) => record.result.metrics[m.key] !== undefined).map((m) => (
                <Readout
                  key={m.key}
                  label={m.label}
                  value={record.result.metrics[m.key]! * (m.scale ?? 1)}
                  unit={m.unit}
                  decimals={m.decimals}
                  provenance={{
                    modelVersions: record.result.modelVersions,
                    inputHash: record.inputHash,
                    timestamp: record.ranAt,
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-start gap-8">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider opacity-60">
                Convergence — mtow per iterate
              </div>
              <div className="rounded border bg-panel p-2" style={{ borderColor: 'var(--line)' }}>
                <ConvergenceSparkline trace={record.result.iterTrace} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider opacity-60">
                Iteration table
              </div>
              <div
                className="max-h-48 overflow-y-auto rounded border bg-panel"
                style={{ borderColor: 'var(--line)' }}
              >
                <table className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr className="border-b text-left opacity-60" style={{ borderColor: 'var(--line)' }}>
                      <th className="px-3 py-1">#</th>
                      <th className="px-3 py-1">mtow kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.result.iterTrace.map((v, i) => (
                      <tr key={i}>
                        <td className="px-3 py-0.5 opacity-60">{i + 1}</td>
                        <td className="px-3 py-0.5">{v.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
