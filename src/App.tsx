/**
 * App shell — left-rail navigation per SPEC §10, 300 ms crossfade on view
 * change (the only motion besides Readout count-ups), reduced-motion aware.
 */
import { useEffect } from 'react';
import { useAppStore, VIEW_ORDER, type ViewId } from './ui/state/appStore';
import { useConfigStore } from './ui/state/configStore';
import { CatalogView } from './ui/views/CatalogView';
import { BuilderView } from './ui/views/BuilderView';
import { MissionView } from './ui/views/MissionView';
import { RunView } from './ui/views/RunView';

function Placeholder({ phase }: { phase: string }) {
  return (
    <p className="text-sm opacity-60">
      This view arrives in {phase}.
    </p>
  );
}

const VIEWS: Record<ViewId, () => JSX.Element> = {
  catalog: CatalogView,
  builder: BuilderView,
  mission: MissionView,
  run: RunView,
  tradespace: () => <Placeholder phase="phase 4 (DOE, Pareto, trade space)" />,
  n2: () => <Placeholder phase="phase 6 (N2 connectivity matrix)" />,
  sysml: () => <Placeholder phase="phase 5 (SysML v2 mini-modeler)" />,
};

export default function App() {
  const { view, setView } = useAppStore();
  const {
    init, loaded, configurations, activeId, setActive,
    createConfiguration, resetDemoData,
  } = useConfigStore();

  useEffect(() => {
    void init();
  }, [init]);

  const ViewComponent = VIEWS[view];

  return (
    <div className="flex min-h-screen">
      {/* Left rail */}
      <nav
        className="flex w-44 shrink-0 flex-col border-r bg-panel"
        style={{ borderColor: 'var(--line)' }}
        aria-label="Views"
      >
        <div className="px-4 py-4">
          <div
            className="text-lg font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Aether
            <br />
            Trade Studio
          </div>
        </div>
        {VIEW_ORDER.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className="px-4 py-2 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
            style={{
              fontFamily: 'var(--font-display)',
              outlineColor: 'var(--trace)',
              background: view === v.id ? 'var(--paper)' : 'transparent',
              borderLeft:
                view === v.id ? '3px solid var(--signal)' : '3px solid transparent',
              opacity: v.ready ? 1 : 0.45,
            }}
            aria-current={view === v.id ? 'page' : undefined}
          >
            {v.label}
          </button>
        ))}
        <div className="mt-auto p-4">
          <button
            type="button"
            onClick={() => void resetDemoData()}
            className="w-full rounded border px-2 py-1 text-xs opacity-70 hover:opacity-100"
            style={{ borderColor: 'var(--line)' }}
          >
            Reset demo data
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-3 border-b bg-panel px-6 py-3"
          style={{ borderColor: 'var(--line)' }}
        >
          <label className="text-sm">
            <span className="mr-2 text-xs uppercase tracking-wider opacity-60">
              Configuration
            </span>
            <select
              value={activeId ?? ''}
              onChange={(e) => setActive(e.target.value)}
              className="rounded border bg-panel px-2 py-1"
              style={{ borderColor: 'var(--line)' }}
            >
              {configurations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const name = prompt('New configuration name?');
              if (name) void createConfiguration(name);
            }}
            className="rounded border px-3 py-1 text-sm"
            style={{ borderColor: 'var(--line)' }}
          >
            New
          </button>
        </header>
        <main key={view} className="view-fade min-h-0 flex-1 overflow-y-auto p-6">
          {loaded ? <ViewComponent /> : <p className="text-sm opacity-60">Loading…</p>}
        </main>
      </div>
    </div>
  );
}
