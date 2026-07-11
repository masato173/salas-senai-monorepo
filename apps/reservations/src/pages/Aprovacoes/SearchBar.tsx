import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-subtle)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar professor..."
        aria-label="Buscar professor"
        style={{
          width: '100%',
          height: 36,
          padding: '0 12px 0 32px',
          borderRadius: 'var(--radius-s)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
