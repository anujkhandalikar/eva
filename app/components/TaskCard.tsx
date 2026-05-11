'use client';

import React, { useState } from 'react';
import LLMDropdown from './LLMDropdown';

type TaskStatus = 'pending' | 'running' | 'done' | 'needs_approval' | 'failed';

export type Task = {
  id: string;
  created_at: string;
  input: string;
  status: TaskStatus;
  result_summary: string | null;
  result_full: string | null;
  error_reason: string | null;
  requires_approval: boolean;
  approved: boolean;
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-stone-100 text-stone-500 border border-stone-200',
  running: 'bg-orange-50 text-orange-600 border border-orange-200 animate-pulse',
  done: 'bg-orange-50 text-orange-700 border border-orange-200',
  needs_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
  failed: 'bg-red-50 text-red-600 border border-red-200',
};

const statusLabels: Record<TaskStatus, string> = {
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

export default function TaskCard({ task }: { task: Task }) {
  const [rerunning, setRerunning] = useState(false);

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const firstLink =
    extractFirstLink(task.result_summary) ?? extractFirstLink(task.result_full);

  async function handleRerun() {
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="bg-white/75 backdrop-blur-xl border border-[#EDE8E2] rounded-2xl p-5 mb-2 flex flex-col gap-3 shadow-[0_4px_24px_rgba(217,119,86,0.07),0_1px_4px_rgba(0,0,0,0.04)]">

      <div className="flex justify-between items-start gap-4">
        <p className="font-semibold text-lg leading-snug flex-1 text-stone-900" style={{ fontFamily: 'var(--font-grotesk)' }}>{task.input}</p>
        {task.status !== 'done' && (
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
        )}
      </div>

      {(task.result_summary || task.error_reason) && (
        <div className="text-stone-600 text-sm leading-relaxed">
          {task.error_reason ? (
            <span className="text-red-500">Error: {task.error_reason}</span>
          ) : (
            <ol className="flex flex-col gap-2">
              {(task.result_summary ?? '').split('\n').filter(line => line.trim()).map((line, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="text-stone-300 shrink-0 font-medium">{i + 1}.</span>
                  <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {firstLink && (
        <a
          href={firstLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-2 px-4 rounded-full border border-[#EDE8E2] text-stone-500 text-sm hover:border-orange-300 hover:text-orange-600 transition-colors bg-white/50"
        >
          link
        </a>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-[#EDE8E2] shrink-0">
        <button
          onClick={handleRerun}
          disabled={rerunning || task.status === 'running'}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-orange-50 hover:text-orange-600 text-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {rerunning ? '⏳' : '🔄'}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-300">{date}</span>
          <LLMDropdown task={task} compact />
        </div>
      </div>

    </div>
  );
}
