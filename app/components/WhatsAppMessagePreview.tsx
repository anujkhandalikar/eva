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
  const [sent, setSent] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  // Currently selected recipient — defaults to the proposed match, switchable
  // to any surfaced candidate.
  const [selected, setSelected] = useState({
    jid: message.recipient,
    name: message.recipient_name,
  });

  const candidates = message.candidates ?? [];
  // Full option list = proposed match + alternatives (proposed first, de-duped).
  const options = [
    { jid: message.recipient, name: message.recipient_name },
    ...candidates.filter((c) => c.jid !== message.recipient),
  ];

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/whatsapp-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: selected.jid, recipient_name: selected.name }),
      });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    setCancelled(true);
    await fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
  }

  if (sent) {
    return (
      <div className="eva-micro" style={{ color: '#22c55e', fontWeight: 600 }}>
        Message sent to {selected.name}
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="eva-micro" style={{ color: 'rgba(255,255,255,0.32)', fontWeight: 600 }}>
        Cancelled
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
        <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.012em' }}>
          {selected.name}
        </span>
        {message.alias && selected.jid === message.recipient && (
          <span
            className="eva-tag rounded px-1.5 py-0.5"
            style={{ color: 'rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.06)', letterSpacing: '0.08em' }}
          >
            alias: {message.alias}
          </span>
        )}
      </div>

      {options.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="eva-micro" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.04em' }}>
            Not right? Pick the contact:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {options.map((c) => {
              const active = c.jid === selected.jid;
              return (
                <button
                  key={c.jid}
                  onClick={() => setSelected(c)}
                  className="eva-tab rounded-full px-3 py-1 transition-colors"
                  style={{
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    background: active ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p
        className="eva-body italic rounded-lg px-3 py-2"
        style={{
          color: 'rgba(255,255,255,0.72)',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        &ldquo;{message.body}&rdquo;
      </p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={handleCancel}
          className="px-4 py-1.5 rounded-full eva-tab transition-colors"
          style={{ color: 'rgba(255,255,255,0.42)', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.72)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.42)'; }}
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-4 py-1.5 rounded-full eva-tab disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: '#22c55e', color: '#fff' }}
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}
