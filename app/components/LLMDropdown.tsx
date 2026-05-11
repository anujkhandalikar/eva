'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  {
    id: 'blindspots',
    emoji: '⚠️',
    label: 'What am I missing?',
    sublabel: 'Blind spots, risks & overlooked angles',
    buildPrompt: (task) => `My Question:
${task.input}

Eva's Initial Analysis:
${task.result_full || task.result_summary || 'No analysis available.'}

---

Now tell me: what are the blind spots, risks, or things I might be underestimating or overlooking here? Be honest and direct — what does the analysis not surface that I should really know about?`,
  },
  {
    id: 'deeper',
    emoji: '🔍',
    label: 'Go deeper',
    sublabel: 'Full context, nuance & the big picture',
    buildPrompt: (task) => `My Question:
${task.input}

Eva's Initial Analysis:
${task.result_full || task.result_summary || 'No analysis available.'}

---

Now give me a comprehensive, deep-dive analysis. What's the full picture here? Include nuances, broader context, competing perspectives, and anything that would help me truly understand this topic at a level beyond the initial summary.`,
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
          ? 'w-9 h-9 rounded-full bg-stone-100 hover:bg-orange-50 text-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          : 'w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-[#EDE8E2] shadow-lg text-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed'
        }
      >
        ❄️
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl border border-[#EDE8E2] bg-white/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(217,119,86,0.10),0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-[#EDE8E2]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              What do you want to explore?
            </p>
          </div>

          <div className="p-1.5 flex flex-col gap-0.5">
            {ANGLES.map((angle) => (
              <button
                key={angle.id}
                onClick={() => handleAngle(angle)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors group flex items-start gap-2.5"
              >
                <span className="text-base leading-none mt-0.5">{angle.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-stone-700 group-hover:text-stone-900 transition-colors leading-snug">
                    {angle.label}
                  </p>
                  <p className="text-[11px] text-stone-400 group-hover:text-stone-500 transition-colors mt-0.5 leading-snug">
                    {angle.sublabel}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-[#EDE8E2]">
            <p className="text-[10px] text-stone-300">
              Opens Claude · Full analysis included
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
