import React from 'react';
import { Layers, List, LayoutGrid } from 'lucide-react';

export type ViewMode = 'cards' | 'bento' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

const OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  { value: 'cards', icon: <Layers size={14} />, label: 'Card view' },
  { value: 'bento', icon: <LayoutGrid size={14} />, label: 'Bento view' },
  { value: 'list', icon: <List size={14} />, label: 'List view' },
];

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {OPTIONS.map((opt) => {
        const active = view === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-label={opt.label}
            className="w-8 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)',
              background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.42)';
              }
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
