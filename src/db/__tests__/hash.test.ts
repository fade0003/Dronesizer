import { describe, expect, it } from 'vitest';
import { canonicalHash, canonicalJson } from '../hash';

describe('canonical input hashing (SPEC §6/§8)', () => {
  it('is key-order independent', async () => {
    const a = await canonicalHash({ x: 1, y: 2 });
    const b = await canonicalHash({ y: 2, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('distinguishes different values', async () => {
    expect(await canonicalHash({ x: 1 })).not.toBe(
      await canonicalHash({ x: 1.0001 }),
    );
  });

  it('canonicalizes nested structures deterministically', () => {
    expect(canonicalJson({ b: [1, { d: 2, c: 3 }], a: null })).toBe(
      '{"a":null,"b":[1,{"c":3,"d":2}]}',
    );
  });
});
