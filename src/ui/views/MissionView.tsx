/**
 * Mission view — P0 scope: the hardcoded profiles, read-only, with the
 * active selection shared with the Run view. The segment editor is P1.
 */
import { useRunStore } from '../state/runStore';
import { MISSION_PROFILES } from '../missions';

export function MissionView() {
  const { missionId, setMission } = useRunStore();
  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm opacity-70">
        P0 ships fixed mission profiles; the segment editor arrives with the
        P1 scope. The selected profile drives the Run view.
      </p>
      <div className="grid gap-3">
        {MISSION_PROFILES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMission(m.id)}
            className="rounded border bg-panel p-4 text-left"
            style={{
              borderColor: missionId === m.id ? 'var(--trace)' : 'var(--line)',
              borderWidth: missionId === m.id ? 2 : 1,
            }}
            aria-pressed={missionId === m.id}
          >
            <div className="font-medium">{m.name}</div>
            <div className="text-sm opacity-70">{m.description}</div>
            <div className="mt-2 text-xs opacity-60" style={{ fontFamily: 'var(--font-mono)' }}>
              {m.segments
                .map(
                  (s) =>
                    `${s.kind} ${(s.durationS / 60).toFixed(0)} min${s.speedMs ? ` @ ${s.speedMs} m/s` : ''}`,
                )
                .join(' → ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
