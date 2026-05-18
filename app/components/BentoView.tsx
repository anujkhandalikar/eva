'use client';

import React, { useMemo } from 'react';
import { Task } from './TaskCard';

type TileSize = 'sm' | 'wide' | 'tall' | 'lg';

const SIZE_CLASS: Record<TileSize, string> = {
  sm: 'col-span-1 row-span-1',
  wide: 'col-span-2 row-span-1',
  tall: 'col-span-1 row-span-2',
  lg: 'col-span-2 row-span-2',
};

const statusDotColor: Record<string, string> = {
  pending: 'rgba(255,255,255,0.25)',
  running: 'rgba(255,255,255,0.55)',
  done: '#22c55e',
  needs_approval: '#eab308',
  failed: '#ef4444',
  needs_otp: '#3b82f6',
  captured: 'rgba(255,255,255,0.25)',
};

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickSize(task: Task): TileSize {
  const h = hashId(task.id);
  const hasImage = !!task.image_url;
  // Images bias toward bigger tiles so the photo gets room.
  if (hasImage) {
    const pool: TileSize[] = ['lg', 'wide', 'tall', 'lg', 'sm'];
    return pool[h % pool.length];
  }
  const pool: TileSize[] = ['sm', 'sm', 'sm', 'wide', 'tall', 'lg'];
  return pool[h % pool.length];
}

interface BentoViewProps {
  tasks: Task[];
  onOpen: (id: string) => void;
}

export default function BentoView({ tasks, onOpen }: BentoViewProps) {
  const tiles = useMemo(
    () => tasks.map((t) => ({ task: t, size: pickSize(t) })),
    [tasks]
  );

  if (tasks.length === 0) {
    return (
      <div
        className="text-center p-8 rounded-xl eva-body"
        style={{
          color: 'rgba(255,255,255,0.24)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        Nothing to show.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div
        className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4 auto-rows-[7rem] sm:auto-rows-[9rem]"
        style={{ gridAutoFlow: 'dense' }}
      >
        {tiles.map(({ task, size }) => (
          <BentoTile
            key={task.id}
            task={task}
            size={size}
            onOpen={() => onOpen(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  task: Task;
  size: TileSize;
  onOpen: () => void;
}

function BentoTile({ task, size, onOpen }: TileProps) {
  const status = task.status;
  const dot = statusDotColor[status] ?? statusDotColor.pending;
  const isRunning = status === 'running';
  const big = size === 'lg' || size === 'wide' || size === 'tall';
  const hasImage = !!task.image_url;

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      onClick={onOpen}
      className={`${SIZE_CLASS[size]} relative rounded-xl overflow-hidden text-left flex flex-col justify-between p-3 transition-transform hover:scale-[1.015] active:scale-[0.99]`}
      style={{
        background: hasImage ? '#000' : '#111111',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {hasImage && task.image_url && (
        <>
          <img
            src={task.image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 100%)',
            }}
          />
        </>
      )}

      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${isRunning ? 'animate-pulse' : ''}`}
          style={{ background: dot }}
        />
        <span
          className="eva-meta shrink-0"
          style={{ color: hasImage ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)' }}
        >
          {date}
        </span>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <p
          className="eva-title"
          style={{
            color: task.input ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
            display: '-webkit-box',
            WebkitLineClamp: big ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: big ? 16 : 13,
            letterSpacing: big ? '-0.026em' : '-0.022em',
            lineHeight: 1.22,
            fontStyle: task.input ? 'normal' : 'italic',
          }}
        >
          {task.input || (hasImage && task.status === 'pending' ? 'Eva is looking at this…' : '—')}
        </p>
      </div>
    </button>
  );
}
