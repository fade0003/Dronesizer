import { create } from 'zustand';

export type ViewId =
  | 'catalog'
  | 'builder'
  | 'mission'
  | 'run'
  | 'tradespace'
  | 'n2'
  | 'sysml';

export const VIEW_ORDER: { id: ViewId; label: string; ready: boolean }[] = [
  { id: 'catalog', label: 'Catalog', ready: true },
  { id: 'builder', label: 'Builder', ready: true },
  { id: 'mission', label: 'Mission', ready: true },
  { id: 'run', label: 'Run', ready: true },
  { id: 'tradespace', label: 'Trade space', ready: true },
  { id: 'n2', label: 'N2', ready: false },
  { id: 'sysml', label: 'SysML', ready: false },
];

interface AppState {
  view: ViewId;
  setView: (view: ViewId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'catalog',
  setView: (view) => set({ view }),
}));
