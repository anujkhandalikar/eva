import React from 'react';
import { Layers, List } from 'lucide-react';

export type ViewMode = 'cards' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-white/60 backdrop-blur-xl p-1 rounded-xl border border-[#EDE8E2] shadow-[0_2px_12px_rgba(217,119,86,0.07)]">
      <button
        onClick={() => onChange('cards')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
          view === 'cards'
            ? 'bg-white text-stone-800 shadow-sm border border-[#EDE8E2]'
            : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        <Layers size={14} />
        Cards
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
          view === 'list'
            ? 'bg-white text-stone-800 shadow-sm border border-[#EDE8E2]'
            : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        <List size={14} />
        List
      </button>
    </div>
  );
}
