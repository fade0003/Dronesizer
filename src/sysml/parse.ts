/** Thin typed wrapper around the generated Peggy parser. */
import { parse as peggyParse, SyntaxError } from './parser.js';
import type { ParseErrorInfo, SysmlPackage } from './ast';

export type ParseResult =
  | { ok: true; package: SysmlPackage }
  | { ok: false; error: ParseErrorInfo };

export function parseSysml(source: string): ParseResult {
  try {
    return { ok: true, package: peggyParse(source) };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return {
        ok: false,
        error: {
          message: e.message,
          line: e.location.start.line,
          column: e.location.start.column,
          offset: e.location.start.offset,
        },
      };
    }
    throw e;
  }
}
