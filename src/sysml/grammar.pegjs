// SysML v2 textual notation — deliberate subset (SPEC §9, and nothing more).
// Supported: package, part def (Real attributes with optional value/unit),
// part usages (typed, counted, composed), connect, requirement def.
// `// @catalog:<componentId>` comments override catalog matching; all other
// comments are whitespace.

Start
  = _ pkg:Package _ { return pkg; }

Package
  = "package" __ name:Ident _ "{" _ items:Item* "}" {
      const pkg = { name, partDefs: [], parts: [], connects: [], requirements: [] };
      for (const item of items) pkg[item.kind].push(item.node);
      return pkg;
    }

Item
  = node:PartDef _    { return { kind: 'partDefs', node }; }
  / node:RequirementDef _ { return { kind: 'requirements', node }; }
  / node:PartUsage _  { return { kind: 'parts', node }; }
  / node:Connect _    { return { kind: 'connects', node }; }

PartDef
  = "part" __ "def" __ name:Ident _ "{" _ attrs:(a:AttributeDecl _ { return a; })* "}" {
      return { name, attributes: attrs, line: location().start.line };
    }

AttributeDecl
  = "attribute" __ name:Ident _ ":" _ "Real" value:(_ "=" _ n:Number { return n; })? unit:(__ "unit" __ u:Ident { return u; })? _ ";" {
      return {
        name,
        value: value === null ? undefined : value,
        unit: unit === null ? undefined : unit,
      };
    }

PartUsage
  = "part" __ !("def" __) name:Ident
    type:(_ ":" _ t:Ident { return t; })?
    count:(_ "[" _ n:Integer _ "]" { return n; })?
    body:(_ b:UsageBody { return b; })?
    _ ";"? tag:CatalogTag? {
      return {
        name,
        type: type === null ? undefined : type,
        count: count === null ? undefined : count,
        attributes: body ? body.attributes : [],
        children: body ? body.children : [],
        catalogId: tag === null ? undefined : tag,
        line: location().start.line,
      };
    }

UsageBody
  = "{" _ entries:(e:UsageEntry _ { return e; })* "}" {
      const attributes = [];
      const children = [];
      for (const e of entries) {
        if (e.entry === 'attribute') attributes.push(e.node);
        else children.push(e.node);
      }
      return { attributes, children };
    }

UsageEntry
  = node:AttributeDecl { return { entry: 'attribute', node }; }
  / node:PartUsage     { return { entry: 'part', node }; }

Connect
  = "connect" __ from:Ident __ "to" __ to:Ident _ ";" {
      return { from, to, line: location().start.line };
    }

RequirementDef
  = "requirement" __ "def" __ name:Ident _ "{" _
    "attribute" __ "threshold" _ ":" _ "Real" _ "=" _ value:Number __ "unit" __ unit:Ident _ ";" _
    "subject" __ subject:Ident _ ";" _
    "constraint" _ "{" _ metric:Ident _ op:("<=" / ">=") _ "threshold" _ "}" _ ";"? _
    "}" {
      return {
        name,
        threshold: { value, unit },
        subject,
        constraint: { metric, op },
        line: location().start.line,
      };
    }

CatalogTag
  = HSpace* "//" HSpace* "@catalog:" id:CatalogId { return id; }

CatalogId
  = chars:[0-9a-fA-F-]+ { return chars.join(''); }

Ident
  = first:[A-Za-z_] rest:[A-Za-z0-9_]* { return first + rest.join(''); }

Number
  = minus:"-"? int:[0-9]+ frac:("." [0-9]+)? {
      return parseFloat((minus ?? '') + int.join('') + (frac ? '.' + frac[1].join('') : ''));
    }

Integer
  = digits:[0-9]+ { return parseInt(digits.join(''), 10); }

// Whitespace and comments. A comment that is a catalog tag is NOT skipped
// here, so PartUsage can capture it.
_  = (WhiteSpace / Comment)*
__ = (WhiteSpace / Comment)+

WhiteSpace = [ \t\r\n]
HSpace = [ \t]

Comment
  = "//" !(HSpace* "@catalog:") (![\r\n] .)*
