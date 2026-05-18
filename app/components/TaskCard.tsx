'use client';

import React, { useState } from 'react';
import LLMDropdown from './LLMDropdown';
import BlinkitCartPreview from './BlinkitCartPreview';
import OtpInput from './OtpInput';
import CalendarActionPreview from './CalendarActionPreview';
import WhatsAppMessagePreview from './WhatsAppMessagePreview';
import type { CalendarAction } from '@/lib/openai';
import type { ProposedMessage } from '@/lib/whatsapp';

type TaskStatus = 'pending' | 'running' | 'done' | 'needs_approval' | 'failed' | 'needs_otp' | 'captured';

export type CartItem = {
  requested: string;
  name: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  url?: string;
  image_url?: string;
  not_found?: boolean;
};

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
  task_type?: 'research' | 'blinkit_order' | 'calendar' | 'whatsapp';
  proposed_cart?: CartItem[] | null;
  calendar_action?: CalendarAction | null;
  calendar_event_id?: string | null;
  proposed_message?: ProposedMessage | null;
  entry_type?: 'task' | 'thought';
  tags?: string[];
  classification_confidence?: number | null;
  promoted_to_task_id?: string | null;
  image_url?: string | null;
};

const statusDotColor: Record<TaskStatus, string> = {
  pending: 'rgba(255,255,255,0.2)',
  running: 'rgba(255,255,255,0.5)',
  done: '#22c55e',
  needs_approval: '#eab308',
  failed: '#ef4444',
  needs_otp: '#3b82f6',
  captured: 'rgba(255,255,255,0.2)',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  needs_approval: 'Needs Approval',
  failed: 'Failed',
  needs_otp: 'Waiting for OTP',
  captured: 'Captured',
};

function stripLinks(text: string): string {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
}

function extractFirstLink(text: string | null): { label: string; url: string } | null {
  if (!text) return null;
  const match = text.match(/\[(.*?)\]\((https?:\/\/[^)]+)\)/);
  if (!match) return null;
  return { label: match[1], url: match[2] };
}

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const ACTIVE_STATUSES: TaskStatus[] = ['pending', 'running', 'needs_approval', 'needs_otp'];

export default function TaskCard({ task }: { task: Task }) {
  const [rerunning, setRerunning] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCalendar = task.task_type === 'calendar';
  const isBlinkit = task.task_type === 'blinkit_order';
  const isWhatsApp = task.task_type === 'whatsapp';

  const confidence = task.classification_confidence;
  const isLowConfidence =
    typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;
  const isTask = (task.entry_type ?? 'task') === 'task';
  const isActive = ACTIVE_STATUSES.includes(task.status);

  async function handleReclassifyToThought(confirmIfActive = false) {
    if (reclassifying) return;
    if (confirmIfActive && isActive) {
      const ok = window.confirm('Cancel this task and move to thoughts?');
      if (!ok) return;
    }
    setReclassifying(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/reclassify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_type: 'thought' }),
      });
      if (!res.ok) console.error('reclassify failed', res.status, await res.text());
    } finally {
      setReclassifying(false);
    }
  }

  const firstLink =
    (!isCalendar && !isBlinkit && !isWhatsApp)
      ? (extractFirstLink(task.result_summary) ?? extractFirstLink(task.result_full))
      : null;

  async function handleRerun() {
    setRerunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/rerun`, { method: 'POST' });
    } finally {
      setRerunning(false);
    }
  }

  const dotColor = statusDotColor[task.status];
  const isRunning = task.status === 'running';

  return (
    <div
      className="mb-2 flex flex-col gap-3 p-5 rounded-xl"
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <p
          className="font-bold text-base leading-snug flex-1 letter-tight"
          style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em' }}
        >
          {task.input}
        </p>

        {task.status !== 'done' && (
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'animate-pulse' : ''}`}
              style={{ background: dotColor }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {statusLabels[task.status]}
            </span>
          </div>
        )}
      </div>

      {isLowConfidence && isTask && (
        <button
          onClick={() => handleReclassifyToThought(true)}
          disabled={reclassifying}
          className="text-[11px] italic self-start transition-colors disabled:opacity-40"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.25)';
          }}
        >
          {reclassifying ? 'Saving…' : 'Eva wasn’t sure — is this a thought?'}
        </button>
      )}

      {(task.result_summary || task.error_reason) && (
        <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {task.error_reason ? (
            <span style={{ color: '#ef4444' }}>Error: {task.error_reason}</span>
          ) : (
            <ol className="flex flex-col gap-2">
              {(task.result_summary ?? '').split('\n').filter(line => line.trim()).map((line, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="shrink-0 font-medium" style={{ color: 'rgba(255,255,255,0.18)' }}>{i + 1}.</span>
                  <span>{stripLinks(line.replace(/^[-–—]\s*/, ''))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {task.status === 'needs_otp' && (
        <OtpInput taskId={task.id} />
      )}

      {isBlinkit && task.proposed_cart && task.status === 'needs_approval' && (
        <BlinkitCartPreview cart={task.proposed_cart} taskId={task.id} />
      )}

      {isCalendar && task.calendar_action && task.status === 'needs_approval' && (
        <CalendarActionPreview action={task.calendar_action} taskId={task.id} />
      )}

      {isWhatsApp && task.proposed_message && task.status === 'needs_approval' && (
        <WhatsAppMessagePreview message={task.proposed_message} taskId={task.id} />
      )}

      {firstLink && (
        <a
          href={firstLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-2 px-4 rounded-full text-sm transition-colors"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          {(() => { try { return new URL(firstLink.url).hostname.replace(/^www\./, ''); } catch { return 'link'; } })()}
        </a>
      )}

      <div
        className="flex justify-between items-center pt-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={handleRerun}
          disabled={rerunning || task.status === 'running'}
          className="w-8 h-8 rounded-full flex items-center justify-center text-base disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
        >
          {rerunning ? '⏳' : '↺'}
        </button>
        <div className="flex items-center gap-3">
          {isTask && (
            <button
              onClick={() => handleReclassifyToThought(true)}
              disabled={reclassifying}
              className="text-[11px] transition-colors disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.25)';
              }}
              title="Move to thoughts"
            >
              {reclassifying ? '…' : '→ thought'}
            </button>
          )}
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>{date}</span>
          <LLMDropdown task={task} compact />
        </div>
      </div>
    </div>
  );
}
