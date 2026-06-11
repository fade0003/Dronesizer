/** The SPEC §9 example — ships as the SysML view's default buffer. */
export const SYSML_EXAMPLE = `package EnduranceQuad {
  part def Motor    { attribute kv : Real = 240 unit rpm_per_V; attribute mass : Real = 0.184 unit kg; }
  part def Battery  { attribute specificEnergy : Real = 230 unit Wh_per_kg; }
  part vehicle {
    part motors : Motor [4];
    part pack : Battery;
    part frame : Frame650;
  }
  connect pack to motors;
  requirement def HoverEndurance {
    attribute threshold : Real = 30 unit min;
    subject vehicle;
    constraint { enduranceMin >= threshold }
  }
}
`;
