'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Snowflake } from 'lucide-react';
import { Task } from './TaskCard';

interface LLMDropdownProps {
  task: Task | undefined;
  compact?: boolean;
}

type Angle = {
  id: string;
  emoji: string;
  label: string;
  sublabel: string;
  buildPrompt: (task: Task) => string;
};

const ANGLES: Angle[] = [
  {
    id: 'relevance',
    emoji: '🎯',
    label: 'Why it matters to me',
    sublabel: 'Personal relevance & implications',
    buildPrompt: (task) => `My Question:
${task.input}

Eva's Initial Analysis:
${task.result_full || task.result_summary || 'No analysis available.'}

---

Now tell me: why is this specifically relevant or important to me right now? What are the real-world implications I should be thinking about? Connect this directly to how it affects my decisions or priorities.`,
  },
  {
    id: 'actions',
    emoji: '📋',
    label: 'Key action items',
    sublabel: 'What should I actually do?',
    buildPrompt: (task) => `My Question:
${task.input}

Eva's Initial Analysis:
${task.result_full || task.result_summary || 'No analysis available.'}

---

Now tell me: based on this analysis, what are the 3–5 most important things I should actually do or act on? Be specific, prioritized, and practical. Focus on what moves the needle most.`,
  },
];

export default function LLMDropdown({ task, compact = false }: LLMDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAngle = (angle: Angle) => {
    if (!task) return;
    const prompt = angle.buildPrompt(task);
    navigator.clipboard.writeText(prompt).catch(() => {});
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" style={{ zIndex: 50 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (task) setOpen((prev) => !prev);
        }}
        disabled={!task}
        className={compact
          ? 'w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          : 'w-14 h-14 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm border border-[#EDE8E2] dark:border-stone-700 shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed'
        }
      >
        <Snowflake size={compact ? 16 : 22} />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl border border-[#EDE8E2] dark:border-stone-700 bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(217,119,86,0.10),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-[#EDE8E2] dark:border-stone-700">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              What do you want to explore?
            </p>
          </div>

          <div className="p-1.5 flex flex-col gap-0.5">
            {ANGLES.map((angle) => (
              <button
                key={angle.id}
                onClick={() => handleAngle(angle)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-stone-800 transition-colors group flex items-start gap-2.5"
              >
                <span className="text-base leading-none mt-0.5">{angle.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors leading-snug">
                    {angle.label}
                  </p>
                  <p className="text-[11px] text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors mt-0.5 leading-snug">
                    {angle.sublabel}
                  </p>
                </div>
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
