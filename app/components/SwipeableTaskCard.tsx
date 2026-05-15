'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Task } from './TaskCard';
import BlinkitCartPreview from './BlinkitCartPreview';
import CalendarActionPreview from './CalendarActionPreview';
import WhatsAppMessagePreview from './WhatsAppMessagePreview';
import OtpInput from './OtpInput';

interface SwipeableTaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onKeep: (id: string) => void;
  index: number;
}

const statusDotColor: Record<Task['status'], string> = {
  pending: 'rgba(255,255,255,0.2)',
  running: 'rgba(255,255,255,0.5)',
  done: '#22c55e',
  needs_approval: '#eab308',
  failed: '#ef4444',
  needs_otp: '#3b82f6',
  captured: 'rgba(255,255,255,0.2)',
};

const statusLabels: Record<Task['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  needs_approval: 'Needs Approval',
  failed: 'Failed',
  needs_otp: 'Waiting for OTP',
  captured: 'Captured',
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

  const isRunning = task.status === 'running';
  const dotColor = statusDotColor[task.status];

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
      <div
        className="rounded-2xl w-full h-full flex flex-col relative overflow-hidden"
        style={{
          background: '#111111',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Delete overlay */}
        <motion.div
          style={{ opacity: deleteOpacity, background: 'rgba(239,68,68,0.12)', backdropFilter: 'blur(4px)' }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="rounded-full p-5 shadow-lg" style={{ background: '#ef4444' }}>
            <X className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Keep overlay */}
        <motion.div
          style={{ opacity: keepOpacity, background: 'rgba(34,197,94,0.10)', backdropFilter: 'blur(4px)' }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="rounded-full p-5 shadow-lg" style={{ background: '#22c55e' }}>
            <Check className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Card content */}
        <div className="flex flex-col h-full z-10 relative p-6 gap-4">

          {task.status !== 'done' && (
            <div className="flex justify-end shrink-0">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'animate-pulse' : ''}`}
                  style={{ background: dotColor }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {statusLabels[task.status]}
                </span>
              </div>
            </div>
          )}

          <p
            className="font-bold text-xl leading-snug shrink-0"
            style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em' }}
          >
            {task.input}
          </p>

          <div
            ref={resultsWrapperRef}
            className={`flex-1 min-h-0 ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            {(task.result_summary || task.error_reason) ? (
              <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {task.error_reason ? (
                  <span className="font-medium" style={{ color: '#ef4444' }}>Error: {task.error_reason}</span>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {resultLines.map((line, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span className="shrink-0 font-medium" style={{ color: 'rgba(255,255,255,0.18)' }}>{i + 1}.</span>
                        <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm italic" style={{ color: 'rgba(255,255,255,0.22)' }}>
                {task.status === 'running' ? 'Processing task...' : 'No result yet.'}
              </div>
            )}
          </div>

          {overflows && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
              className="shrink-0 text-xs transition-colors text-left -mt-2"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {task.status === 'needs_otp' && (
            <div className="shrink-0">
              <OtpInput taskId={task.id} />
            </div>
          )}

          {task.task_type === 'blinkit_order' && task.proposed_cart && task.status === 'needs_approval' && (
            <div className="shrink-0">
              <BlinkitCartPreview cart={task.proposed_cart} taskId={task.id} />
            </div>
          )}

          {task.task_type === 'calendar' && task.calendar_action && task.status === 'needs_approval' && (
            <div className="shrink-0">
              <CalendarActionPreview action={task.calendar_action} taskId={task.id} />
            </div>
          )}

          {task.task_type === 'whatsapp' && task.proposed_message && task.status === 'needs_approval' && (
            <div className="shrink-0">
              <WhatsAppMessagePreview message={task.proposed_message} taskId={task.id} />
            </div>
          )}

          {firstLink && task.task_type !== 'blinkit_order' && (
            <a
              href={firstLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 block text-center py-2 px-4 rounded-full text-sm transition-colors"
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              link
            </a>
          )}

        </div>
      </div>
    </motion.div>
  );
}
