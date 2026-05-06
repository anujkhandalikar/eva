'use client';

import React, { useState } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Task } from './TaskCard';
import LLMDropdown from './LLMDropdown';
import { Trash2, RefreshCw } from 'lucide-react';

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

export default function SwipeableTaskCard({ task, onDelete, onKeep, index }: SwipeableTaskCardProps) {
  const controls = useAnimation();
  const [exitX, setExitX] = useState<number>(0);
  const [rerunning, setRerunning] = useState(false);
  const isFront = index === 0;

  async function handleRerun() {
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  const handleDragEnd = async (e: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x < -threshold) {
      setExitX(-250);
      await controls.start({ x: -250, opacity: 0, transition: { duration: 0.2 } });
      onDelete(task.id);
    } else if (info.offset.x > threshold) {
      setExitX(250);
      await controls.start({ x: 250, opacity: 0, transition: { duration: 0.2 } });
      onKeep(task.id);
    } else {
      controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      className="absolute top-0 left-0 right-0 h-full w-full will-change-transform flex items-center justify-center"
      style={{
        zIndex: 10 - index,
      }}
      animate={controls}
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ 
        scale: isFront ? 1 : 1 - index * 0.05,
        y: isFront ? 0 : index * 15,
        opacity: isFront ? 1 : Math.max(0, 1 - index * 0.2),
        x: 0,
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={isFront ? { cursor: "grabbing" } : undefined}
      style={{
        cursor: isFront ? "grab" : "auto",
        originY: 1
      }}
    >
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm h-[400px] flex flex-col gap-4 shadow-2xl relative">
        
        {/* Swipe Indicators behind the card content */}
        <div className="absolute inset-0 flex justify-between px-6 items-center pointer-events-none opacity-0 z-0 transition-opacity">
           {/* We can animate these based on drag x in a more advanced setup, but keeping it simple for now */}
        </div>

        <div className="flex justify-between items-start gap-4 z-10 relative">
          <p className="font-medium text-xl leading-snug flex-1 text-white line-clamp-4">{task.input}</p>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
              statusColors[task.status]
            }`}
          >
            {statusLabels[task.status]}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 pr-2 custom-scrollbar z-10 relative">
          {(task.result_summary || task.error_reason) ? (
            <div className="bg-[#151515] border border-[#222] rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
              {task.error_reason ? (
                <span className="text-red-400 font-medium">Error: {task.error_reason}</span>
              ) : (
                task.result_summary
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
              {task.status === 'running' ? 'Processing task...' : 'No result yet.'}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#2a2a2a] z-10 relative">
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
    </motion.div>
  );
}
