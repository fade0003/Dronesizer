import { describe, expect, it } from 'vitest';
import { parseSysml } from '../parse';
import { SYSML_EXAMPLE } from '../example';

describe('SysML v2 subset parser (SPEC §9)', () => {
  it('parses the shipped example with 0 errors', () => {
    const result = parseSysml(SYSML_EXAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pkg = result.package;
    expect(pkg.name).toBe('EnduranceQuad');
    expect(pkg.partDefs.map((d) => d.name)).toEqual(['Motor', 'Battery']);
    expect(pkg.partDefs[0]!.attributes).toEqual([
      { name: 'kv', value: 240, unit: 'rpm_per_V' },
      { name: 'mass', value: 0.184, unit: 'kg' },
    ]);

    const vehicle = pkg.parts[0]!;
    expect(vehicle.name).toBe('vehicle');
    expect(vehicle.children.map((c) => c.name)).toEqual(['motors', 'pack', 'frame']);
    expect(vehicle.children[0]).toMatchObject({ type: 'Motor', count: 4 });
    expect(vehicle.children[2]).toMatchObject({ type: 'Frame650' });

    expect(pkg.connects).toHaveLength(1);
    expect(pkg.connects[0]).toMatchObject({ from: 'pack', to: 'motors' });

    expect(pkg.requirements).toHaveLength(1);
    expect(pkg.requirements[0]).toMatchObject({
      name: 'HoverEndurance',
      threshold: { value: 30, unit: 'min' },
      subject: 'vehicle',
      constraint: { metric: 'enduranceMin', op: '>=' },
    });
  });

  it('deleting a semicolon yields an error at the correct line (SPEC §11)', () => {
    // Remove the first ';' on line 2 (after `unit rpm_per_V`).
    const broken = SYSML_EXAMPLE.replace('unit rpm_per_V;', 'unit rpm_per_V');
    const result = parseSysml(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(2);
    expect(result.error.column).toBeGreaterThan(1);
  });

  it('supports attribute redefinition inside a typed usage', () => {
    const result = parseSysml(`package P {
      part def Motor { attribute kv : Real = 240; }
      part m : Motor [2] { attribute kv : Real = 300; }
    }`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.parts[0]!.attributes).toEqual([
      { name: 'kv', value: 300, unit: undefined },
    ]);
  });

  it('captures @catalog override comments but skips normal comments', () => {
    const result = parseSysml(`package P {
      // a normal comment
      part m : Motor [4]; // @catalog:00000000-0000-4000-8000-000000000002
      part p : Prop; // just a note
    }`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.parts[0]!.catalogId).toBe(
      '00000000-0000-4000-8000-000000000002',
    );
    expect(result.package.parts[1]!.catalogId).toBeUndefined();
  });

  it('rejects constructs outside the subset', () => {
    expect(parseSysml('package P { import Foo::*; }').ok).toBe(false);
    expect(parseSysml('part def Loose { }').ok).toBe(false); // no package
  });
});
