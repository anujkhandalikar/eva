'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { Task } from './TaskCard';
import SwipeableTaskCard from './SwipeableTaskCard';
import { Layers, Snowflake } from 'lucide-react';

interface CardStackProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
}

const ANGLES = [
  {
    id: 'relevance',
    emoji: '🎯',
    label: 'Why it matters to me',
    sublabel: 'Personal relevance & implications',
    buildPrompt: (task: Task) => `My Question:\n${task.input}\n\nEva's Initial Analysis:\n${task.result_full || task.result_summary || 'No analysis available.'}\n\n---\n\nNow tell me: why is this specifically relevant or important to me right now? What are the real-world implications I should be thinking about?`,
  },
  {
    id: 'actions',
    emoji: '📋',
    label: 'Key action items',
    sublabel: 'What should I actually do?',
    buildPrompt: (task: Task) => `My Question:\n${task.input}\n\nEva's Initial Analysis:\n${task.result_full || task.result_summary || 'No analysis available.'}\n\n---\n\nNow tell me: based on this analysis, what are the 3–5 most important things I should actually do or act on?`,
  },
];

export default function CardStack({ tasks, onDeleteTask }: CardStackProps) {
  const [localQueue, setLocalQueue] = useState<Task[]>([]);
  const [swipeCount, setSwipeCount] = useState(0);
  const [rerunning, setRerunning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  async function handleRerunFront() {
    const front = localQueue[0];
    if (!front || rerunning || front.status === 'running') return;
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${front.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  function handleAngle(buildPrompt: (task: Task) => string) {
    const front = localQueue[0];
    if (!front) return;
    const prompt = buildPrompt(front);
    navigator.clipboard.writeText(prompt).catch(() => {});
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, '_blank');
    setDropdownOpen(false);
  }

  useEffect(() => {
    setLocalQueue((prevQueue) => {
      const validQueue = prevQueue.filter((qTask) => tasks.some((t) => t.id === qTask.id));
      const updatedQueue = validQueue.map((qTask) => {
        const fresh = tasks.find((t) => t.id === qTask.id);
        return fresh ?? qTask;
      });
      const newTasks = tasks.filter((t) => !prevQueue.some((qTask) => qTask.id === t.id));
      return [...newTasks, ...updatedQueue];
    });
  }, [tasks]);

  const handleKeep = (id: string) => {
    setSwipeCount((c) => c + 1);
    setTimeout(() => {
      setLocalQueue((prev) => {
        const taskToMove = prev.find((t) => t.id === id);
        if (!taskToMove) return prev;
        return [...prev.filter((t) => t.id !== id), taskToMove];
      });
    }, 200);
  };

  const handleDelete = (id: string) => {
    setSwipeCount((c) => c + 1);
    setTimeout(() => {
      setLocalQueue((prev) => prev.filter((t) => t.id !== id));
      onDeleteTask(id);
    }, 200);
  };

  if (localQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'rgba(255,255,255,0.22)' }}>
        <Layers size={48} style={{ opacity: 0.15 }} />
        <p>No tasks left in the pile.</p>
      </div>
    );
  }

  const visibleTasks = localQueue.slice(0, 3);
  const currentPos = (swipeCount % localQueue.length) + 1;
  const frontTask = localQueue[0];

  return (
    <div className="flex flex-col items-center h-full">
      <div className="relative w-full flex-1 min-h-0">
        <AnimatePresence>
          {visibleTasks.map((task, index) => (
            <SwipeableTaskCard
              key={task.id}
              task={task}
              index={index}
              onDelete={handleDelete}
              onKeep={handleKeep}
            />
          )).reverse()}
        </AnimatePresence>
      </div>

      <div className="shrink-0 h-28 flex items-start justify-center pt-3 text-sm tabular-nums font-medium" style={{ color: 'rgba(255,255,255,0.22)' }}>
        {currentPos}/{localQueue.length}
      </div>

      {createPortal(
        <>
          {/* Re-run — bottom left */}
          <button
            onClick={handleRerunFront}
            disabled={rerunning || frontTask?.status === 'running'}
            style={{
              position: 'fixed', bottom: 32, left: 32, zIndex: 40,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
            }}
            className="w-14 h-14 rounded-full text-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {rerunning ? '⏳' : '↺'}
          </button>

          {/* Explore — mobile: bottom center; desktop: bottom right */}
          <div
            ref={dropdownRef}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0 z-40"
          >
            {dropdownOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mb-2 w-64 rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(20,20,20,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}
              >
                <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Explore
                  </p>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  {ANGLES.map((angle) => (
                    <button
                      key={angle.id}
                      onClick={() => handleAngle(angle.buildPrompt)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <span className="text-base leading-none mt-0.5">{angle.emoji}</span>
                      <div>
                        <p className="text-sm font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {angle.label}
                        </p>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {angle.sublabel}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => frontTask && setDropdownOpen((o) => !o)}
              disabled={!frontTask}
              style={{
                lineHeight: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
              }}
              className="w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Snowflake size={24} />
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
