import React from 'react';
import { Layers, List } from 'lucide-react';

export type ViewMode = 'cards' | 'list';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl p-1 rounded-xl border border-[#EDE8E2] dark:border-stone-700 shadow-[0_2px_12px_rgba(217,119,86,0.07)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <button
        onClick={() => onChange('cards')}
        className={`flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
          view === 'cards'
            ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm border border-[#EDE8E2] dark:border-stone-700'
            : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
        }`}
      >
        <Layers size={16} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
          view === 'list'
            ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm border border-[#EDE8E2] dark:border-stone-700'
            : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
        }`}
      >
        <List size={16} />
      </button>
    </div>
  );
}
