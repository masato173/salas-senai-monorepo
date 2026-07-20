// ─────────────────────────────────────────────────────────────
// JsonTree — F6.4
//
// Renderização recursiva de valores JSON em árvore colapsável.
// Usa <details>/<summary> HTML nativo — sem estado próprio.
// Segurança: todo conteúdo é texto React — sem dangerouslySetInnerHTML.
// ─────────────────────────────────────────────────────────────

interface JsonTreeProps {
  value: unknown;
  depth?: number;
  maxDepth?: number; // padrão 4 — evita recursão infinita
}

const COLORS = {
  string: 'var(--color-green)',
  number: 'var(--color-blue)',
  boolean: 'var(--color-blue)',
  null: 'var(--color-subtle)',
  key: 'var(--color-muted)',
};

function JsonNode({ value, depth = 0, maxDepth = 4 }: JsonTreeProps): JSX.Element {
  if (value === null) {
    return <span style={{ color: COLORS.null }}>null</span>;
  }

  if (typeof value === 'string') {
    return <span style={{ color: COLORS.string }}>"{value}"</span>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span style={{ color: COLORS.number }}>{String(value)}</span>;
  }

  // Profundidade máxima atingida — fallback para JSON bruto
  if (depth >= maxDepth) {
    return <span style={{ color: COLORS.null, fontSize: 11 }}>{JSON.stringify(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: COLORS.null }}>[]</span>;
    return (
      <details open={depth < 2}>
        <summary style={{ cursor: 'pointer', color: COLORS.key, fontSize: 12 }}>
          [{value.length} {value.length === 1 ? 'item' : 'itens'}]
        </summary>
        <div
          style={{ paddingLeft: 12, borderLeft: '1px solid var(--color-border)', marginLeft: 4 }}
        >
          {value.map((item: unknown, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: '1.6' }}>
              <span style={{ color: COLORS.key }}>{i}: </span>
              <JsonNode value={item} depth={depth + 1} maxDepth={maxDepth} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: COLORS.null }}>{'{}'}</span>;
    return (
      <details open={depth < 2}>
        <summary style={{ cursor: 'pointer', color: COLORS.key, fontSize: 12 }}>
          {'{'}
          {entries.length} {entries.length === 1 ? 'campo' : 'campos'}
          {'}'}
        </summary>
        <div
          style={{ paddingLeft: 12, borderLeft: '1px solid var(--color-border)', marginLeft: 4 }}
        >
          {entries.map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, lineHeight: '1.6' }}>
              <span style={{ color: COLORS.key }}>{k}: </span>
              <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  return <span>{String(value)}</span>;
}

export function JsonTree({ value, maxDepth = 4 }: JsonTreeProps): JSX.Element {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--color-subtle)', fontSize: 12 }}>—</span>;
  }
  return (
    <pre
      style={{
        margin: 0,
        fontSize: 12,
        fontFamily: 'monospace',
        background: 'var(--color-surface-2)',
        borderRadius: 6,
        padding: '8px 10px',
        overflow: 'auto',
        maxHeight: 200,
      }}
    >
      <JsonNode value={value} depth={0} maxDepth={maxDepth} />
    </pre>
  );
}
