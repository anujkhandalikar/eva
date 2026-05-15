'use client';

import React from 'react';

export type EntryFilter = 'all' | 'tasks' | 'thoughts';

const TAB_LABEL: Record<EntryFilter, string> = {
  all: 'All',
  tasks: 'Tasks',
  thoughts: 'Thoughts',
};

export interface FilterBarProps {
  filter: EntryFilter;
  onFilterChange: (f: EntryFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export default function FilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  availableTags,
  selectedTags,
  onToggleTag,
}: FilterBarProps) {
  const showTags = filter !== 'tasks' && availableTags.length > 0;

  return (
    <div className="flex flex-col gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {(Object.keys(TAB_LABEL) as EntryFilter[]).map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => onFilterChange(key)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={{
                  color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.4)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  letterSpacing: '-0.01em',
                }}
              >
                {TAB_LABEL[key]}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="flex-1 px-3 py-1.5 rounded-full text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.01em',
          }}
        />
      </div>

      {showTags && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors"
                style={{
                  color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active
                    ? '1px solid rgba(255,255,255,0.18)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
