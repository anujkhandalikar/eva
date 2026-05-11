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
      className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:text-stone-500 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors"
      aria-label={view === 'cards' ? 'Switch to list view' : 'Switch to card view'}
    >
      {view === 'cards' ? <Layers size={16} /> : <List size={16} />}
    </button>
  );
}
