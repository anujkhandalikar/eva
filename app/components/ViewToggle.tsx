import React from 'react';
import { Layers, List } from 'lucide-react';

export type ViewMode = 'cards' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <button
      onClick={() => onChange(view === 'cards' ? 'list' : 'cards')}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
      style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)';
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
      aria-label={view === 'cards' ? 'Switch to list view' : 'Switch to card view'}
    >
      {view === 'cards' ? <Layers size={16} /> : <List size={16} />}
    </button>
  );
}
