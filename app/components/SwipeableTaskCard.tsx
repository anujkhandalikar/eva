'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Task } from './TaskCard';

interface SwipeableTaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onKeep: (id: string) => void;
  index: number;
}

const statusColors: Record<Task['status'], string> = {
  pending: 'bg-stone-100 text-stone-500 border border-stone-200',
  running: 'bg-orange-50 text-orange-600 border border-orange-200 animate-pulse',
  done: 'bg-orange-50 text-orange-700 border border-orange-200',
  needs_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
  failed: 'bg-red-50 text-red-600 border border-red-200',
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
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const isFront = index === 0;

  const resultsWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
    const el = resultsWrapperRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setOverflows(el.scrollHeight > el.clientHeight);
    });
    return () => cancelAnimationFrame(id);
  }, [task.result_summary, task.error_reason]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const deleteOpacity = useTransform(x, [-150, -20, 0], [0.9, 0, 0]);
  const keepOpacity = useTransform(x, [0, 20, 150], [0, 0, 0.9]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -100) {
      setExitX(-600);
      setTimeout(() => onDelete(task.id), 200);
    } else if (info.offset.x > 100) {
      setExitX(600);
      setTimeout(() => onKeep(task.id), 200);
    }
  };

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
      <div className="bg-white/80 backdrop-blur-2xl border border-[#EDE8E2] rounded-2xl w-full h-full flex flex-col shadow-[0_8px_40px_rgba(217,119,86,0.09),0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden">

        {/* Delete overlay */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 bg-red-400/15 backdrop-blur-sm z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="bg-red-500/90 rounded-full p-5 shadow-lg">
            <X className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Keep overlay */}
        <motion.div
          style={{ opacity: keepOpacity }}
          className="absolute inset-0 bg-orange-300/15 backdrop-blur-sm z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="rounded-full p-5 shadow-lg" style={{ backgroundColor: '#D97756' }}>
            <Check className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Card content */}
        <div className="flex flex-col h-full z-10 relative p-6 gap-4">

          {task.status !== 'done' && (
            <div className="flex justify-end shrink-0">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            </div>
          )}

          <p
            className="font-semibold text-xl text-stone-900 leading-snug shrink-0"
            style={{ fontFamily: 'var(--font-grotesk)' }}
          >
            {task.input}
          </p>

          <div
            ref={resultsWrapperRef}
            className={`flex-1 min-h-0 ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            {(task.result_summary || task.error_reason) ? (
              <div className="text-stone-600 text-sm leading-relaxed">
                {task.error_reason ? (
                  <span className="text-red-500 font-medium">Error: {task.error_reason}</span>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {resultLines.map((line, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span className="text-stone-300 shrink-0 font-medium">{i + 1}.</span>
                        <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400 text-sm italic">
                {task.status === 'running' ? 'Processing task...' : 'No result yet.'}
              </div>
            )}
          </div>

          {overflows && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
              className="shrink-0 text-xs text-stone-400 hover:text-orange-600 transition-colors text-left -mt-2"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {firstLink && (
            <a
              href={firstLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 block text-center py-2 px-4 rounded-full border border-[#EDE8E2] text-stone-500 text-sm hover:border-orange-300 hover:text-orange-600 transition-colors bg-white/50"
            >
              link
            </a>
          )}

        </div>
      </div>
    </motion.div>
  );
}
