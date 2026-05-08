'use client';

import React, { useState } from 'react';
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

function renderInsight(text: string): React.ReactNode {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (match) {
      return (
        <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
          {match[1]}
        </a>
      );
    }
    return part;
  });
}

export default function SwipeableTaskCard({ task, onDelete, onKeep, index }: SwipeableTaskCardProps) {
  const [exitX, setExitX] = useState<number | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const isFront = index === 0;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);

  // Color overlays — reactive to drag position
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

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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

        {/* Delete overlay (swipe left) */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 bg-red-600/40 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <X className="w-24 h-24 text-white drop-shadow-lg" strokeWidth={3} />
        </motion.div>

        {/* Keep overlay (swipe right) */}
        <motion.div
          style={{ opacity: keepOpacity }}
          className="absolute inset-0 bg-green-500/40 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <Check className="w-24 h-24 text-white drop-shadow-lg" strokeWidth={3} />
        </motion.div>

        {/* Card content */}
        <div className="flex flex-col gap-4 p-6 h-full z-10 relative">
          <div className="flex justify-between items-start gap-4">
            <p className="font-medium text-xl leading-snug flex-1 text-white line-clamp-4">{task.input}</p>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${statusColors[task.status]}`}
            >
              {statusLabels[task.status]}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {(task.result_summary || task.error_reason) ? (
              <div className="bg-[#151515] border border-[#222] rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
                {task.error_reason ? (
                  <span className="text-red-400 font-medium">Error: {task.error_reason}</span>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {(task.result_summary ?? '').split('\n').filter(line => line.trim()).map((line, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span className="text-gray-500 shrink-0 font-medium mt-0.5">{i + 1}.</span>
                        <span>{renderInsight(line.replace(/^[-–—]\s*/, ''))}</span>
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

          <div className="flex justify-between items-center pt-4 border-t border-[#2a2a2a]">
            <div className="text-xs text-gray-500">{date}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRerun}
                disabled={rerunning || task.status === 'running'}
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {rerunning ? '...' : '↺ Rerun'}
              </button>
              <LLMDropdown task={task} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
