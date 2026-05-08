'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Task } from './TaskCard';

interface LLMDropdownProps {
  task: Task;
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

export default function LLMDropdown({ task }: LLMDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
          setOpen((prev) => !prev);
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
          open
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'bg-[#2a2a2a] hover:bg-[#333] text-gray-300 hover:text-white border border-transparent'
        }`}
      >
        <Sparkles size={13} className={open ? 'text-violet-400' : ''} />
        Tell me more
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-[#333] bg-[#1a1a1a] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              What do you want to explore?
            </p>
          </div>

          {/* Angle options */}
          <div className="p-1.5 flex flex-col gap-0.5">
            {ANGLES.map((angle) => (
              <button
                key={angle.id}
                onClick={() => handleAngle(angle)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#262626] transition-colors group flex items-start gap-2.5"
              >
                <span className="text-base leading-none mt-0.5">{angle.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors leading-snug">
                    {angle.label}
                  </p>
                  <p className="text-[11px] text-gray-500 group-hover:text-gray-400 transition-colors mt-0.5 leading-snug">
                    {angle.sublabel}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-[#2a2a2a]">
            <p className="text-[10px] text-gray-600">
              Opens Claude · Full analysis included
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
