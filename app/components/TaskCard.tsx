import React from 'react';

type TaskStatus = 'pending' | 'running' | 'done' | 'needs_approval' | 'failed';

export type Task = {
  id: string;
  created_at: string;
  input: string;
  status: TaskStatus;
  result_summary: string | null;
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

export default function TaskCard({ task }: { task: Task }) {
  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 mb-2 text-white flex flex-col gap-3">
      <div className="flex justify-between items-start gap-4">
        <p className="font-medium text-lg leading-snug flex-1">{task.input}</p>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
            statusColors[task.status]
          }`}
        >
          {statusLabels[task.status]}
        </span>
      </div>

      {(task.result_summary || task.error_reason) && (
        <div className="bg-[#151515] border border-[#222] rounded-lg p-4 text-gray-300 text-sm leading-relaxed mt-1">
          {task.error_reason ? (
            <span className="text-red-400">Error: {task.error_reason}</span>
          ) : (
            task.result_summary
          )}
        </div>
      )}

      <div className="text-xs text-gray-600 mt-1">{date}</div>
    </div>
  );
}
