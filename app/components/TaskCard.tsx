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
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 mb-2 text-white flex flex-col gap-3">

      {/* Header: question + status */}
      <div className="flex justify-between items-start gap-4">
        <p className="font-semibold text-lg leading-snug flex-1">{task.input}</p>
        {task.status !== 'done' && (
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shrink-0 ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
        )}
      </div>

      {/* Result body */}
      {(task.result_summary || task.error_reason) && (
        <div className="text-gray-300 text-sm leading-relaxed">
          {task.error_reason ? (
            <span className="text-red-400">Error: {task.error_reason}</span>
          ) : (
            <ol className="flex flex-col gap-2">
              {(task.result_summary ?? '').split('\n').filter(line => line.trim()).map((line, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="text-gray-500 shrink-0 font-medium">{i + 1}.</span>
                  <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Single link */}
      {firstLink && (
        <a
          href={firstLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-2 px-4 rounded-full border border-[#3a3a3a] text-gray-400 text-sm hover:border-gray-500 hover:text-gray-300 transition-colors"
        >
          link
        </a>
      )}

      {/* Bottom: Re-run | Tell me more | date */}
      <div className="flex justify-between items-center pt-2 border-t border-[#2a2a2a]">
        <button
          onClick={handleRerun}
          disabled={rerunning || task.status === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {rerunning ? '...' : '↺ Re-run'}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{date}</span>
          <LLMDropdown task={task} />
        </div>
      </div>

    </div>
  );
}
