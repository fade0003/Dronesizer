/**
 * Builder view — React Flow canvas (SPEC §10): palette left, drop/click
 * components, auto-wire by role, live mass/cost ticker bottom bar.
 */
import { useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Component, ComponentClass, Configuration } from '../../db/schema';
import { useConfigStore } from '../state/configStore';

// Vertical lanes per role, in power-chain order.
const LANES: ComponentClass[] = ['battery', 'esc', 'fc', 'vtx', 'motor', 'prop', 'frame', 'payload'];
// Auto-wire rules: role → upstream role it connects to (first match wins).
const WIRE_TO: Partial<Record<string, string[]>> = {
  esc: ['battery'],
  fc: ['battery'],
  vtx: ['fc', 'battery'],
  motor: ['esc', 'battery'],
  prop: ['motor'],
  payload: ['frame'],
  frame: ['battery'],
};

function buildGraph(
  config: Configuration,
  componentsById: Map<string, Component>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = config.instances.map((inst, i) => {
    const c = componentsById.get(inst.componentId);
    const lane = LANES.indexOf(inst.role as ComponentClass);
    return {
      id: `${inst.role}:${inst.componentId}`,
      position: { x: (lane < 0 ? LANES.length : lane) * 190, y: 40 + (i % 3) * 30 },
      data: {
        label: `${c?.model ?? inst.componentId} ×${inst.count}`,
      },
      style: {
        border: '1px solid var(--line)',
        background: 'var(--panel)',
        color: 'var(--ink)',
        fontSize: 12,
        borderRadius: 4,
        padding: 6,
        width: 170,
      },
    };
  });
  const byRole = new Map<string, string>();
  for (const node of nodes) byRole.set(node.id.split(':')[0]!, node.id);
  const edges: Edge[] = [];
  for (const node of nodes) {
    const role = node.id.split(':')[0]!;
    for (const target of WIRE_TO[role] ?? []) {
      const targetId = byRole.get(target);
      if (targetId) {
        edges.push({
          id: `${node.id}->${targetId}`,
          source: targetId,
          target: node.id,
          style: { stroke: 'var(--trace)' },
        });
        break;
      }
    }
  }
  return { nodes, edges };
}

export function BuilderView() {
  const {
    components, componentsById, configurations, activeId,
    addInstance, setInstanceCount, removeInstance,
  } = useConfigStore();
  const active = configurations.find((c) => c.id === activeId);

  const graph = useMemo(
    () => (active ? buildGraph(active, componentsById) : { nodes: [], edges: [] }),
    [active, componentsById],
  );
  // The graph is derived data: run React Flow uncontrolled (defaultNodes/
  // defaultEdges manage measurement internally) and remount when the
  // configuration's instance set changes.
  const graphKey = useMemo(
    () =>
      active
        ? `${active.id}:${active.instances
            .map((i) => `${i.role}.${i.componentId}.${i.count}`)
            .join('|')}`
        : 'none',
    [active],
  );

  const ticker = useMemo(() => {
    if (!active) return null;
    let fixedG = 0;
    let bom = 0;
    for (const inst of active.instances) {
      const c = componentsById.get(inst.componentId);
      if (!c) continue;
      bom += c.unitCostUsd * inst.count;
      if (c.cls !== 'battery') fixedG += c.massKg * 1000 * inst.count;
    }
    return { fixedG, bom, loaded: bom * 1.25 };
  }, [active, componentsById]);

  const palette = useMemo(() => {
    const groups = new Map<string, Component[]>();
    for (const c of components) {
      const list = groups.get(c.cls) ?? [];
      list.push(c);
      groups.set(c.cls, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [components]);

  if (!active) return <p>No configuration selected — create one from the header.</p>;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-wrap gap-3 xl:flex-nowrap">
        {/* Palette */}
        <aside
          className="w-60 shrink-0 overflow-y-auto rounded border bg-panel p-2"
          style={{ borderColor: 'var(--line)' }}
          aria-label="Component palette"
        >
          {palette.map(([cls, items]) => (
            <div key={cls} className="mb-2">
              <div className="px-1 text-xs uppercase tracking-wider opacity-50">{cls}</div>
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void addInstance(c.id)}
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-paper"
                  title={`${c.mfr} ${c.model} — $${c.unitCostUsd}`}
                >
                  {c.model}
                </button>
              ))}
            </div>
          ))}
        </aside>
        {/* Canvas */}
        <div
          className="min-h-80 flex-1 rounded border"
          style={{ borderColor: 'var(--line)', background: 'var(--panel)', minWidth: 320 }}
        >
          <ReactFlow
            key={graphKey}
            defaultNodes={graph.nodes}
            defaultEdges={graph.edges}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#C7CFD6" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {/* Instance list */}
        <aside
          className="w-72 shrink-0 overflow-y-auto rounded border bg-panel p-2"
          style={{ borderColor: 'var(--line)' }}
          aria-label="Configuration instances"
        >
          <div className="px-1 pb-1 text-xs uppercase tracking-wider opacity-50">
            {active.name}
          </div>
          {active.instances.map((inst) => {
            const c = componentsById.get(inst.componentId);
            return (
              <div
                key={`${inst.role}:${inst.componentId}`}
                className="mb-1 flex items-center gap-1 rounded border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="min-w-0 flex-1 truncate" title={c?.model}>
                  <span className="opacity-50">{inst.role}</span> {c?.model}
                </span>
                <button
                  type="button"
                  aria-label={`Decrease ${c?.model} count`}
                  onClick={() => void setInstanceCount(inst.componentId, inst.role, inst.count - 1)}
                  className="rounded border px-1"
                  style={{ borderColor: 'var(--line)' }}
                >
                  −
                </button>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{inst.count}</span>
                <button
                  type="button"
                  aria-label={`Increase ${c?.model} count`}
                  onClick={() => void setInstanceCount(inst.componentId, inst.role, inst.count + 1)}
                  className="rounded border px-1"
                  style={{ borderColor: 'var(--line)' }}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${c?.model}`}
                  onClick={() => void removeInstance(inst.componentId, inst.role)}
                  className="rounded border px-1"
                  style={{ borderColor: 'var(--line)', color: 'var(--diverged)' }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </aside>
      </div>
      {/* Live ticker */}
      {ticker && (
        <div
          className="flex flex-wrap gap-6 rounded border bg-panel px-4 py-2 text-sm"
          style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}
        >
          <span>dry mass {ticker.fixedG.toFixed(0)} g <span className="opacity-50">(battery sized at run)</span></span>
          <span>BOM ${ticker.bom.toFixed(0)}</span>
          <span>loaded ${ticker.loaded.toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}
