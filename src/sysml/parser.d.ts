import type { SysmlPackage } from './ast';

export interface PeggyLocation {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}

export class SyntaxError extends Error {
  location: PeggyLocation;
  expected: unknown[];
  found: string | null;
}

export function parse(input: string): SysmlPackage;
