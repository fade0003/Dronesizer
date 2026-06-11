/** AST produced by the generated Peggy parser (SPEC §9 subset). */

export interface SysmlAttribute {
  name: string;
  value?: number;
  unit?: string;
}

export interface SysmlPartDef {
  name: string;
  attributes: SysmlAttribute[];
  line: number;
}

export interface SysmlPartUsage {
  name: string;
  type?: string;
  count?: number;
  attributes: SysmlAttribute[];
  children: SysmlPartUsage[];
  /** From a `// @catalog:<componentId>` override comment. */
  catalogId?: string;
  line: number;
}

export interface SysmlConnect {
  from: string;
  to: string;
  line: number;
}

export interface SysmlRequirementDef {
  name: string;
  threshold: { value: number; unit: string };
  subject: string;
  constraint: { metric: string; op: '<=' | '>=' };
  line: number;
}

export interface SysmlPackage {
  name: string;
  partDefs: SysmlPartDef[];
  parts: SysmlPartUsage[];
  connects: SysmlConnect[];
  requirements: SysmlRequirementDef[];
}

export interface ParseErrorInfo {
  message: string;
  line: number;
  column: number;
  offset: number;
}
