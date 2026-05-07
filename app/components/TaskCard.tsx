'use client';

import React, { useState } from 'react';

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
  pending: 'bg-gray-500/20 text-gray-400',
  running: 'bg-blue-500/20 text-blue-400 animate-pulse',
  done: 'bg-green-500/20 text-green-400',
  needs_approval: 'bg-yellow-500/20 text-yellow-400',
  failed: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<TaskStatus, string> = {
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

export default function TaskCard({ task }: { task: Task }) {
  const [rerunning, setRerunning] = useState(false);

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  async function handleRerun() {
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 mb-2 text-white flex flex-col gap-3">
      <div className="flex justify-between items-start gap-4">
        <p className="font-medium text-lg leading-snug flex-1">{task.input}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
              statusColors[task.status]
            }`}
          >
            {statusLabels[task.status]}
          </span>
          <button
            onClick={handleRerun}
            disabled={rerunning || task.status === 'running'}
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {rerunning ? '...' : '↺ Rerun'}
          </button>
        </div>
      </div>

      {(task.result_summary || task.error_reason) && (
        <div className="bg-[#151515] border border-[#222] rounded-lg p-4 text-gray-300 text-sm leading-relaxed mt-1">
          {task.error_reason ? (
            <span className="text-red-400">Error: {task.error_reason}</span>
          ) : (
            <ol className="flex flex-col gap-2">
              {(task.result_summary ?? '').split('\n').filter(line => line.trim()).map((line, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="text-gray-500 shrink-0 font-medium">{i + 1}.</span>
                  <span>{renderInsight(line.replace(/^[-–—]\s*/, ''))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="text-xs text-gray-600 mt-1">{date}</div>
    </div>
  );
}
