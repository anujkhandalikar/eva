'use client';

import { useState } from 'react';
import type { CalendarAction } from '@/lib/openai';

const actionLabels: Record<CalendarAction['type'], string> = {
  list: 'View',
  create: 'Create Event',
  update: 'Update Event',
  delete: 'Delete Event',
};

const actionDotColor: Record<CalendarAction['type'], string> = {
  list: '#3b82f6',
  create: '#22c55e',
  update: '#eab308',
  delete: '#ef4444',
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
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: actionDotColor[action.type] }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {actionLabels[action.type]}
        </span>
      </div>

      {action.type === 'create' && (
        <div className="flex flex-col gap-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{action.summary}</p>
          <p style={{ color: 'rgba(255,255,255,0.45)' }}>
            {formatDateTime(action.startTime)} → {formatDateTime(action.endTime)}
          </p>
          {action.location && (
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>📍 {action.location}</p>
          )}
          {action.description && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{action.description}</p>
          )}
          {action.attendees && action.attendees.length > 0 && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {action.attendees.join(', ')}
            </p>
          )}
        </div>
      )}

      {action.type === 'update' && (
        <div className="flex flex-col gap-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>&ldquo;{action.eventSummary}&rdquo;</p>
          {action.summary && (
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Rename to: {action.summary}</p>
          )}
          {action.startTime && (
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>
              New time: {formatDateTime(action.startTime)} → {action.endTime ? formatDateTime(action.endTime) : ''}
            </p>
          )}
          {action.description && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{action.description}</p>
          )}
        </div>
      )}

      {action.type === 'delete' && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>&ldquo;{action.eventSummary}&rdquo;</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>This event will be permanently removed from your calendar.</p>
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={approving || approved}
        className="w-full py-2 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(255,255,255,0.9)', color: '#000' }}
        onMouseEnter={(e) => { if (!approving && !approved) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.75)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.9)'; }}
      >
        {approved ? 'Confirmed' : approving ? 'Processing...' : `Confirm ${actionLabels[action.type]}`}
      </button>
    </div>
  );
}
