'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Task } from './TaskCard';
import LLMDropdown from './LLMDropdown';

interface SwipeableTaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onKeep: (id: string) => void;
  index: number;
}

const statusColors: Record<Task['status'], string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  running: 'bg-blue-500/20 text-blue-400 animate-pulse',
  done: 'bg-green-500/20 text-green-400',
  needs_approval: 'bg-yellow-500/20 text-yellow-400',
  failed: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<Task['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  needs_approval: 'Needs Approval',
  failed: 'Failed',
};

function stripLinks(text: string): string {
  return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
}

function extractFirstLink(text: string | null): { label: string; url: string } | null {
  if (!text) return null;
  const match = text.match(/\[(.*?)\]\((https?:\/\/[^)]+)\)/);
  if (!match) return null;
  return { label: match[1], url: match[2] };
}

export default function SwipeableTaskCard({ task, onDelete, onKeep, index }: SwipeableTaskCardProps) {
  const [exitX, setExitX] = useState<number | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const isFront = index === 0;

  const resultsWrapperRef = useRef<HTMLDivElement>(null);

  // Detect overflow after content renders
  useEffect(() => {
    setExpanded(false);
    const el = resultsWrapperRef.current;
    if (!el) return;
    // Use rAF to measure after paint
    const id = requestAnimationFrame(() => {
      setOverflows(el.scrollHeight > el.clientHeight);
    });
    return () => cancelAnimationFrame(id);
  }, [task.result_summary, task.error_reason]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const deleteOpacity = useTransform(x, [-150, -20, 0], [0.85, 0, 0]);
  const keepOpacity = useTransform(x, [0, 20, 150], [0, 0, 0.85]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -100) {
      setExitX(-600);
      setTimeout(() => onDelete(task.id), 200);
    } else if (info.offset.x > 100) {
      setExitX(600);
      setTimeout(() => onKeep(task.id), 200);
    }
  };

  async function handleRerun(e: React.MouseEvent) {
    e.stopPropagation();
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  const resultLines = (task.result_summary ?? '').split('\n').filter(line => line.trim());
  const firstLink =
    extractFirstLink(task.result_summary) ?? extractFirstLink(task.result_full);

  return (
    <motion.div
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        x: isFront ? x : 0,
        rotate: isFront ? rotate : 0,
        zIndex: 10 - index,
        scale: 1 - index * 0.05,
        y: index * 15,
        opacity: 1 - index * 0.15,
      }}
      animate={exitX !== null ? { x: exitX, opacity: 0, transition: { duration: 0.25 } } : {}}
      drag={isFront ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="cursor-grab active:cursor-grabbing"
    >
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl w-full h-full flex flex-col shadow-2xl relative overflow-hidden">

        {/* Delete overlay */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 bg-red-600/40 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <X className="w-24 h-24 text-white drop-shadow-lg" strokeWidth={3} />
        </motion.div>

        {/* Keep overlay */}
        <motion.div
          style={{ opacity: keepOpacity }}
          className="absolute inset-0 bg-green-500/40 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <Check className="w-24 h-24 text-white drop-shadow-lg" strokeWidth={3} />
        </motion.div>

        {/* Card content */}
        <div className="flex flex-col h-full z-10 relative p-6 gap-4">

          {/* Status — hidden when done */}
          {task.status !== 'done' && (
            <div className="flex justify-end shrink-0">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            </div>
          )}

          {/* Question */}
          <p className="font-semibold text-xl text-white leading-snug shrink-0">{task.input}</p>

          {/* Results — overflow-hidden when collapsed, overflow-y-auto when expanded */}
          <div
            ref={resultsWrapperRef}
            className={`flex-1 min-h-0 ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            {(task.result_summary || task.error_reason) ? (
              <div className="text-gray-300 text-sm leading-relaxed">
                {task.error_reason ? (
                  <span className="text-red-400 font-medium">Error: {task.error_reason}</span>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {resultLines.map((line, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span className="text-gray-500 shrink-0 font-medium">{i + 1}.</span>
                        <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
                {task.status === 'running' ? 'Processing task...' : 'No result yet.'}
              </div>
            )}
          </div>

          {/* Read more / Show less — only rendered if content genuinely overflows */}
          {overflows && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors text-left -mt-2"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {/* Single link */}
          {firstLink && (
            <a
              href={firstLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 block text-center py-2 px-4 rounded-full border border-[#3a3a3a] text-gray-400 text-sm hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              link
            </a>
          )}

          {/* Bottom bar: Re-run | Tell me more */}
          <div className="flex justify-between items-center pt-3 border-t border-[#2a2a2a] shrink-0">
            <button
              onClick={handleRerun}
              disabled={rerunning || task.status === 'running'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {rerunning ? '...' : '↺ Re-run'}
            </button>
            <LLMDropdown task={task} />
          </div>

        </div>
      </div>
    </motion.div>
  );
}
