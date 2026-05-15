'use client';

import React from 'react';
import type { Task } from './TaskCard';

export default function ThoughtCard({
  task,
  onDelete,
}: {
  task: Task;
  onDelete?: (id: string) => void;
}) {
  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tags = task.tags ?? [];

  async function handleDelete() {
    if (onDelete) onDelete(task.id);
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
  }

  return (
    <div
      className="group mb-2 flex flex-col gap-3 p-5 rounded-xl"
      style={{
        background: '#0c0c0c',
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: '2px dotted rgba(255,255,255,0.18)',
      }}
    >
      <p
        className="text-base leading-snug"
        style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}
      >
        {task.input}
      </p>

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

      <div
        className="flex justify-between items-center pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
          {date}
        </span>
        <button
          onClick={handleDelete}
          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
