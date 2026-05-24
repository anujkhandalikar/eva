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

// Border color mirrors electron/overlay/index.html `.ambient-dot` palette.
// `done` is the silent default — neutral border.
const DEFAULT_BORDER = 'rgba(255,255,255,0.08)';
const COLORED_BORDER = 'rgba(255,255,255,0.10)';
const STATUS_BORDER: Record<string, string | null> = {
  running: 'rgba(234,179,8,0.6)',
  needs_approval: 'rgba(249,115,22,0.65)',
  needs_otp: 'rgba(249,115,22,0.65)',
  failed: 'rgba(239,68,68,0.6)',
  pending: null,
  captured: null,
  done: null,
};

// Tile fill encodes intent bucket. 3-color schema:
//   Know (research, learning) → emerald
//   Do (any other task)       → violet  (default for entry_type=task)
//   Neutral (thoughts)        → graphite
// Red/orange/amber reserved for status borders + stream highlight.
const GRAPHITE = '#141414';
const VIOLET = '#5A3FB8';
const EMERALD = '#2E8056';
const KNOW_CATEGORIES = new Set(['research', 'learning']);

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFill(task: Task): string {
  if (task.image_url) return '#000';
  return pickCategoryColor(task);
}

// Category color independent of image — used to ring image tiles so the
// category bucket survives the photo override.
function pickCategoryColor(task: Task): string {
  if (task.entry_type === 'thought') return GRAPHITE;
  if (task.category && KNOW_CATEGORIES.has(task.category)) return EMERALD;
  return VIOLET;
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
    <div className="h-full overflow-y-auto pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
  const big = size === 'lg' || size === 'wide' || size === 'tall';
  const hasImage = !!task.image_url;
  const isThought = task.entry_type === 'thought';
  const fill = pickFill(task);
  const isColored = !hasImage && fill !== GRAPHITE;
  const categoryColor = pickCategoryColor(task);
  const imageRing = hasImage && categoryColor !== GRAPHITE ? categoryColor : null;
  const borderColor =
    STATUS_BORDER[task.status] ??
    (imageRing ?? (isColored ? COLORED_BORDER : DEFAULT_BORDER));

  const date = new Date(task.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      onClick={onOpen}
      title={isColored ? task.category ?? undefined : undefined}
      className={`${SIZE_CLASS[size]} relative rounded-xl overflow-hidden text-left flex flex-col justify-between p-3 transition-[transform,filter] hover:scale-[1.015] active:scale-[0.99] hover:brightness-110`}
      style={{
        background: hasImage ? '#000' : fill,
        border: `${isThought ? '1px dotted' : '3px solid'} ${borderColor}`,
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

      <div className="relative flex items-start justify-end gap-2">
        <span
          className="eva-meta shrink-0"
          style={{
            color: hasImage
              ? 'rgba(255,255,255,0.65)'
              : isColored
                ? 'rgba(255,255,255,0.55)'
                : 'rgba(255,255,255,0.28)',
          }}
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
