import { useEffect, useState } from 'react';
import { getDb } from './db/repository';
import type { Component, Configuration } from './db/schema';

/**
 * Phase-1 shell: proves the seeded virtual DB loads through the repository
 * boundary. The real views (Catalog → Builder → … per SPEC §10) arrive in
 * phase 3.
 */
export default function App() {
  const [components, setComponents] = useState<Component[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);

  useEffect(() => {
    const db = getDb();
    void db.components.list().then(setComponents);
    void db.configurations.list().then(setConfigurations);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header
        className="border-b bg-panel px-6 py-4"
        style={{ borderColor: 'var(--line)' }}
      >
        <h1
          className="text-xl font-semibold tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Aether Trade Studio
        </h1>
        <p className="text-sm opacity-70">
          Drone MDAO trade-space demo — phase 1 scaffold
        </p>
      </header>
      <main className="px-6 py-8">
        <div
          className="inline-block rounded border bg-panel px-5 py-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <p style={{ fontFamily: 'var(--font-mono)' }}>
            catalog: {components.length} components ·{' '}
            {configurations.length} seed configurations
          </p>
          <p className="mt-1 text-sm opacity-70">
            Views (Catalog, Builder, Mission, Run, Trade space, N2, SysML)
            land in phases 3–6.
          </p>
        </div>
      </main>
    </div>
  );
}
