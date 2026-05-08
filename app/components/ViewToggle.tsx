import React from 'react';
import { Layers, List } from 'lucide-react';

export type ViewMode = 'cards' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-[#1e1e1e] p-1 rounded-lg border border-[#2a2a2a]">
      <button
        onClick={() => onChange('cards')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          view === 'cards'
            ? 'bg-[#333] text-white shadow-sm'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <Layers size={14} />
        Cards
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          view === 'list'
            ? 'bg-[#333] text-white shadow-sm'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <List size={14} />
        List
      </button>
    </div>
  );
}
