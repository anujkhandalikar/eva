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
      <div className="text-sm text-green-600 dark:text-green-400 font-medium">
        Message sent to {message.recipient_name}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-[#EDE8E2] dark:border-stone-700 rounded-xl p-4 bg-stone-50/60 dark:bg-stone-800/40">
      <div className="flex items-center gap-2">
        <span className="text-lg">💬</span>
        <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">
          {message.recipient_name}
        </span>
        <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">
          {message.recipient.replace('@s.whatsapp.net', '')}
        </span>
      </div>

      <p className="text-sm text-stone-700 dark:text-stone-300 italic leading-relaxed bg-white dark:bg-stone-900 rounded-lg px-3 py-2 border border-[#EDE8E2] dark:border-stone-700">
        &ldquo;{message.body}&rdquo;
      </p>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setDone(true)}
          className="px-4 py-1.5 rounded-full text-xs font-semibold text-stone-500 dark:text-stone-400 border border-[#EDE8E2] dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}
