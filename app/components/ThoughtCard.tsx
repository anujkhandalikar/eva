'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Task } from './TaskCard';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

export default function ThoughtCard({
  task,
  onDelete,
}: {
  task: Task;
  onDelete?: (id: string) => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.input);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tags = task.tags ?? [];
  const confidence = task.classification_confidence;
  const isLowConfidence =
    typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD;

  useEffect(() => {
    if (!editing) setDraft(task.input);
  }, [task.input, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing]);

  async function handleDelete() {
    if (onDelete) onDelete(task.id);
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
  }

  async function handlePromote() {
    if (promoting) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/promote`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      // Source thought stays — it's the audit trail. The new task arrives via
      // real-time subscription on the dashboard.
    } catch (err) {
      console.error('Promote failed:', err);
    } finally {
      setPromoting(false);
    }
  }

  async function handleSaveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(task.input);
      setEditing(false);
      return;
    }
    if (trimmed === task.input) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
    } catch (err) {
      console.error('Edit failed:', err);
      setDraft(task.input);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setDraft(task.input);
    setEditing(false);
  }

  if (hidden) return null;

  return (
    <div
      className="group mb-2 flex flex-col gap-3 p-5 rounded-xl"
      style={{
        background: '#0c0c0c',
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: '2px dotted rgba(255,255,255,0.18)',
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancelEdit();
            }
          }}
          disabled={saving}
          rows={1}
          className="text-base leading-snug resize-none outline-none w-full bg-transparent"
          style={{
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '-0.01em',
            border: 'none',
          }}
        />
      ) : (
        <p
          className="text-base leading-snug"
          style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}
        >
          {task.input}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.45)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {isLowConfidence && (
        <button
          onClick={async () => {
            await handlePromote();
            setHidden(true);
          }}
          className="text-[11px] italic self-start transition-colors"
          style={{ color: 'rgba(255,255,255,0.28)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.28)';
          }}
        >
          Eva wasn&apos;t sure — is this a task?
        </button>
      )}

      <div
        className="flex justify-between items-center pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
          {date}
        </span>
        {editing ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="text-xs disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="text-xs disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Edit
            </button>
            <button
              onClick={handlePromote}
              disabled={promoting}
              className="text-xs disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {promoting ? 'Promoting…' : 'Promote to task'}
            </button>
            <button
              onClick={handleDelete}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
