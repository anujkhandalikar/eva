'use client';

import { useState } from 'react';
import type { CalendarAction } from '@/lib/openai';

const actionLabels: Record<CalendarAction['type'], string> = {
  list: 'View',
  create: 'Create Event',
  update: 'Update Event',
  delete: 'Delete Event',
};

const actionColors: Record<CalendarAction['type'], string> = {
  list: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
  create: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60',
  update: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
  delete: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}

export default function CalendarActionPreview({
  action,
  taskId,
}: {
  action: CalendarAction;
  taskId: string;
}) {
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/tasks/${taskId}/calendar-approve`, { method: 'POST' });
      setApproved(true);
    } finally {
      setApproving(false);
    }
  }

  if (action.type === 'list') return null;

  return (
    <div className="rounded-xl border border-[#EDE8E2] dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${actionColors[action.type]}`}>
          {actionLabels[action.type]}
        </span>
      </div>

      {action.type === 'create' && (
        <div className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
          <p className="font-semibold">{action.summary}</p>
          <p className="text-stone-500 dark:text-stone-400">
            {formatDateTime(action.startTime)} → {formatDateTime(action.endTime)}
          </p>
          {action.location && (
            <p className="text-stone-500 dark:text-stone-400">📍 {action.location}</p>
          )}
          {action.description && (
            <p className="text-stone-500 dark:text-stone-400 text-xs">{action.description}</p>
          )}
          {action.attendees && action.attendees.length > 0 && (
            <p className="text-stone-500 dark:text-stone-400 text-xs">
              {action.attendees.join(', ')}
            </p>
          )}
        </div>
      )}

      {action.type === 'update' && (
        <div className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
          <p className="font-semibold">"{action.eventSummary}"</p>
          {action.summary && (
            <p className="text-stone-500 dark:text-stone-400">Rename to: {action.summary}</p>
          )}
          {action.startTime && (
            <p className="text-stone-500 dark:text-stone-400">
              New time: {formatDateTime(action.startTime)} → {action.endTime ? formatDateTime(action.endTime) : ''}
            </p>
          )}
          {action.description && (
            <p className="text-stone-500 dark:text-stone-400 text-xs">{action.description}</p>
          )}
        </div>
      )}

      {action.type === 'delete' && (
        <div className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
          <p className="font-semibold">"{action.eventSummary}"</p>
          <p className="text-stone-500 dark:text-stone-400 text-xs">This event will be permanently removed from your calendar.</p>
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={approving || approved}
        className="w-full py-2 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300"
      >
        {approved ? 'Confirmed' : approving ? 'Processing...' : `Confirm ${actionLabels[action.type]}`}
      </button>
    </div>
  );
}
