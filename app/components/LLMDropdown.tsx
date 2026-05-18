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
    buildPrompt: (task) => `My Question:\n${task.input}\n\nEva's Initial Analysis:\n${task.result_full || task.result_summary || 'No analysis available.'}\n\n---\n\nNow tell me: why is this specifically relevant or important to me right now? What are the real-world implications I should be thinking about? Connect this directly to how it affects my decisions or priorities.`,
  },
  {
    id: 'actions',
    emoji: '📋',
    label: 'Key action items',
    sublabel: 'What should I actually do?',
    buildPrompt: (task) => `My Question:\n${task.input}\n\nEva's Initial Analysis:\n${task.result_full || task.result_summary || 'No analysis available.'}\n\n---\n\nNow tell me: based on this analysis, what are the 3–5 most important things I should actually do or act on? Be specific, prioritized, and practical. Focus on what moves the needle most.`,
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
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, '_blank');
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
        className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
      >
        <Snowflake size={compact ? 14 : 22} />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(20,20,20,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="eva-eyebrow" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Explore
            </p>
          </div>

          <div className="p-1.5 flex flex-col gap-0.5">
            {ANGLES.map((angle) => (
              <button
                key={angle.id}
                onClick={() => handleAngle(angle)}
                className="w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span className="text-base leading-none mt-0.5">{angle.emoji}</span>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {angle.label}
                  </p>
                  <p className="eva-micro mt-0.5" style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 400 }}>
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
