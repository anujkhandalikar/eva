'use client';

import { useState } from 'react';
import type { CalendarAction } from '@/lib/openai';

const actionLabels: Record<CalendarAction['type'], string> = {
  list: 'View',
  create: 'Create Event',
  update: 'Update Event',
  delete: 'Delete Event',
  task_create: 'Add Task',
  task_list: 'View Tasks',
};

const actionDotColor: Record<CalendarAction['type'], string> = {
  list: '#3b82f6',
  create: '#22c55e',
  update: '#eab308',
  delete: '#ef4444',
  task_create: '#22c55e',
  task_list: '#3b82f6',
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

  if (action.type === 'list' || action.type === 'task_create' || action.type === 'task_list') return null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: actionDotColor[action.type] }} />
        <span className="eva-eyebrow" style={{ color: 'rgba(255,255,255,0.32)' }}>
          {actionLabels[action.type]}
        </span>
      </div>

      {action.type === 'create' && (
        <div className="flex flex-col gap-1 eva-body" style={{ color: 'rgba(255,255,255,0.78)' }}>
          <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>{action.summary}</p>
          <p className="eva-num" style={{ color: 'rgba(255,255,255,0.48)' }}>
            {formatDateTime(action.startTime)} → {formatDateTime(action.endTime)}
          </p>
          {action.location && (
            <p style={{ color: 'rgba(255,255,255,0.48)' }}>📍 {action.location}</p>
          )}
          {action.description && (
            <p className="eva-micro" style={{ color: 'rgba(255,255,255,0.48)' }}>{action.description}</p>
          )}
          {action.attendees && action.attendees.length > 0 && (
            <p className="eva-micro" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {action.attendees.join(', ')}
            </p>
          )}
        </div>
      )}

      {action.type === 'update' && (
        <div className="flex flex-col gap-1 eva-body" style={{ color: 'rgba(255,255,255,0.78)' }}>
          <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>&ldquo;{action.eventSummary}&rdquo;</p>
          {action.summary && (
            <p style={{ color: 'rgba(255,255,255,0.48)' }}>Rename to: {action.summary}</p>
          )}
          {action.startTime && (
            <p className="eva-num" style={{ color: 'rgba(255,255,255,0.48)' }}>
              New time: {formatDateTime(action.startTime)} → {action.endTime ? formatDateTime(action.endTime) : ''}
            </p>
          )}
          {action.description && (
            <p className="eva-micro" style={{ color: 'rgba(255,255,255,0.48)' }}>{action.description}</p>
          )}
        </div>
      )}

      {action.type === 'delete' && (
        <div className="flex flex-col gap-1 eva-body">
          <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>&ldquo;{action.eventSummary}&rdquo;</p>
          <p className="eva-micro" style={{ color: 'rgba(255,255,255,0.48)' }}>This event will be permanently removed from your calendar.</p>
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={approving || approved}
        className="w-full py-2 px-4 rounded-full eva-tab transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(255,255,255,0.92)', color: '#000', fontSize: 13, fontWeight: 600 }}
        onMouseEnter={(e) => { if (!approving && !approved) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.78)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.92)'; }}
      >
        {approved ? 'Confirmed' : approving ? 'Processing...' : `Confirm ${actionLabels[action.type]}`}
      </button>
    </div>
  );
}
