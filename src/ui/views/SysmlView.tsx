/**
 * SysML view — SPEC §10: split pane, CodeMirror editor left (keyword
 * highlighting, inline parse errors), parsed part tree + requirements
 * right, "Apply to Builder" / "Generate from Builder", and the
 * "About this notation" disclaimer popover.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { parseSysml } from '../../sysml/parse';
import { toConfig, type ToConfigResult } from '../../sysml/toConfig';
import { fromConfig } from '../../sysml/fromConfig';
import { SYSML_EXAMPLE } from '../../sysml/example';
import { useConfigStore } from '../state/configStore';
import { useAppStore } from '../state/appStore';
import { getDb } from '../../db/repository';
import type { SysmlPartUsage } from '../../sysml/ast';

const KEYWORDS = new Set([
  'package', 'part', 'def', 'attribute', 'requirement', 'subject',
  'constraint', 'connect', 'to', 'unit',
]);

const sysmlLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.match(/\/\/.*/)) return 'comment';
    if (stream.match(/-?\d+(\.\d+)?/)) return 'number';
    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return 'keyword';
      if (word === 'Real') return 'typeName';
      return 'variableName';
    }
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#0B7285', fontWeight: '600' },
  { tag: tags.typeName, color: '#E8590C' },
  { tag: tags.number, color: '#16212B', fontWeight: '600' },
  { tag: tags.comment, color: '#748089', fontStyle: 'italic' },
]);

const sysmlLinter = linter((view) => {
  const result = parseSysml(view.state.doc.toString());
  if (result.ok) return [];
  const lineInfo = view.state.doc.line(
    Math.min(result.error.line, view.state.doc.lines),
  );
  const from = Math.min(
    lineInfo.from + result.error.column - 1,
    view.state.doc.length,
  );
  return [
    {
      from,
      to: Math.min(from + 1, view.state.doc.length),
      severity: 'error',
      message: result.error.message,
    } satisfies Diagnostic,
  ];
});

function PartTree({ part, depth }: { part: SysmlPartUsage; depth: number }) {
  return (
    <>
      <div style={{ paddingLeft: depth * 14 }} className="py-0.5">
        <span style={{ fontFamily: 'var(--font-mono)' }}>{part.name}</span>
        {part.type && <span className="opacity-60"> : {part.type}</span>}
        {part.count !== undefined && (
          <span style={{ color: 'var(--trace)' }}> [{part.count}]</span>
        )}
      </div>
      {part.children.map((c) => (
        <PartTree key={`${c.name}:${c.line}`} part={c} depth={depth + 1} />
      ))}
    </>
  );
}

export function SysmlView() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [source, setSource] = useState(SYSML_EXAMPLE);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const { components, componentsById, configurations, activeId, setActive, init } =
    useConfigStore();
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;
    const view = new EditorView({
      parent: editorRef.current,
      state: EditorState.create({
        doc: SYSML_EXAMPLE,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          sysmlLanguage,
          syntaxHighlighting(highlight),
          lintGutter(),
          sysmlLinter,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setSource(update.state.doc.toString());
          }),
          EditorView.theme({
            '&': { fontSize: '13px', height: '100%' },
            '.cm-content': { fontFamily: 'var(--font-mono)' },
            '.cm-gutters': { background: 'var(--paper)', borderRight: '1px solid var(--line)' },
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>)['__cmView'] = view;
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  const parsed = useMemo(() => parseSysml(source), [source]);
  const mapped: ToConfigResult | null = useMemo(
    () => (parsed.ok ? toConfig(parsed.package, components) : null),
    [parsed, components],
  );

  const applyToBuilder = async () => {
    if (!mapped) return;
    const db = getDb();
    await db.batch(async () => {
      for (const adHoc of mapped.adHocComponents) {
        await db.components.create(adHoc);
      }
      await db.configurations.create(mapped.configuration);
    });
    // Refresh the config store cache from the repository.
    useConfigStore.setState({ loaded: false });
    await init();
    setActive(mapped.configuration.id);
    setApplied(mapped.configuration.name);
    setView('builder');
  };

  const generateFromBuilder = () => {
    const active = configurations.find((c) => c.id === activeId);
    if (!active || !viewRef.current) return;
    const text = fromConfig(active, componentsById);
    viewRef.current.dispatch({
      changes: { from: 0, to: viewRef.current.state.doc.length, insert: text },
    });
    setSource(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void applyToBuilder()}
          disabled={!mapped}
          className="rounded px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--signal)', fontFamily: 'var(--font-display)' }}
        >
          Apply to Builder
        </button>
        <button
          type="button"
          onClick={generateFromBuilder}
          className="rounded border px-4 py-1.5 text-sm"
          style={{ borderColor: 'var(--trace)', color: 'var(--trace)' }}
        >
          Generate from Builder
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setAboutOpen((o) => !o)}
            className="rounded border px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
            style={{ borderColor: 'var(--line)' }}
            aria-expanded={aboutOpen}
          >
            About this notation
          </button>
          {aboutOpen && (
            <div
              role="dialog"
              className="absolute right-0 top-full z-20 mt-1 w-80 rounded border bg-panel p-3 text-sm shadow-lg"
              style={{ borderColor: 'var(--line)' }}
            >
              Subset of SysML v2 textual notation (OMG standard) for
              demonstration; not a conformant implementation. Supported:
              package, part def with Real attributes, part usages with counts
              and composition, connect, and requirement def with a threshold
              constraint.
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Editor */}
        <div
          className="min-h-96 flex-1 overflow-hidden rounded border bg-panel"
          style={{ borderColor: 'var(--line)' }}
          ref={editorRef}
        />
        {/* Parse results */}
        <aside className="w-96 shrink-0 overflow-y-auto">
          {!parsed.ok && (
            <div
              className="mb-3 rounded border bg-panel p-3 text-sm"
              style={{ borderColor: 'var(--diverged)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--diverged)' }}>
                Parse error
              </span>{' '}
              line {parsed.error.line}, col {parsed.error.column}:{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {parsed.error.message}
              </span>
            </div>
          )}
          {parsed.ok && (
            <>
              <div className="mb-3 rounded border bg-panel p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="mb-1 text-xs uppercase tracking-wider opacity-60">
                  Part tree — {parsed.package.name}
                </div>
                <div className="text-sm">
                  {parsed.package.parts.map((p) => (
                    <PartTree key={`${p.name}:${p.line}`} part={p} depth={0} />
                  ))}
                </div>
                {parsed.package.connects.length > 0 && (
                  <div className="mt-2 text-xs opacity-70" style={{ fontFamily: 'var(--font-mono)' }}>
                    {parsed.package.connects.map((c) => (
                      <div key={`${c.from}-${c.to}`}>
                        {c.from} ─ {c.to}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-3 rounded border bg-panel p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="mb-1 text-xs uppercase tracking-wider opacity-60">
                  Requirements
                </div>
                {mapped && mapped.requirements.length > 0 ? (
                  <table className="w-full text-xs">
                    <tbody>
                      {mapped.requirements.map((r) => (
                        <tr key={r.name}>
                          <td className="py-0.5 pr-2">{r.name}</td>
                          <td className="py-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                            {r.metric} {r.op} {r.value} {r.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs opacity-60">None defined.</p>
                )}
              </div>
              {mapped && (
                <div className="rounded border bg-panel p-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="mb-1 text-xs uppercase tracking-wider opacity-60">
                    Catalog mapping
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {mapped.configuration.instances.map((inst) => {
                        const adHoc = mapped.adHocComponents.find(
                          (c) => c.id === inst.componentId,
                        );
                        const component =
                          adHoc ?? componentsById.get(inst.componentId);
                        return (
                          <tr key={`${inst.role}:${inst.componentId}`}>
                            <td className="py-0.5 pr-2 opacity-60">{inst.role}</td>
                            <td className="py-0.5">
                              {component?.model} ×{inst.count}
                              {adHoc && (
                                <span
                                  className="ml-1 rounded border px-1 text-[10px] uppercase"
                                  style={{ borderColor: 'var(--signal)', color: 'var(--signal)' }}
                                >
                                  ad-hoc
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {mapped.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-xs opacity-70">
                      {mapped.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {applied && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--converged)' }}>
                      Applied “{applied}” to the Builder.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
