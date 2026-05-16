'use client';

import React, { useState } from 'react';
import type { ProposedMessage } from '@/lib/whatsapp';

export default function WhatsAppMessagePreview({
  message,
  taskId,
}: {
  message: ProposedMessage;
  taskId: string;
}) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/whatsapp-approve`, { method: 'POST' });
      if (res.ok) setDone(true);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="text-sm font-medium" style={{ color: '#22c55e' }}>
        Message sent to {message.recipient_name}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">💬</span>
        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {message.recipient_name}
        </span>
        {message.alias && (
          <span
            className="text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)' }}
          >
            alias: {message.alias}
          </span>
        )}
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {message.recipient.replace('@s.whatsapp.net', '')}
        </span>
      </div>

      <p
        className="text-sm italic leading-relaxed rounded-lg px-3 py-2"
        style={{
          color: 'rgba(255,255,255,0.7)',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        &ldquo;{message.body}&rdquo;
      </p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setDone(true)}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: '#22c55e', color: '#fff' }}
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}
