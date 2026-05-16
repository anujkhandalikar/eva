'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import TaskCard, { Task } from '@/app/components/TaskCard';
import ThoughtCard from '@/app/components/ThoughtCard';
import ViewToggle, { ViewMode } from '@/app/components/ViewToggle';
import CardStack from '@/app/components/CardStack';
import FilterBar, { EntryFilter } from '@/app/components/FilterBar';
import AddEntrySheet, { type AddEntrySheetHandle } from '@/app/components/AddEntrySheet';

function readEntryHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#entry-')) return null;
  return decodeURIComponent(hash.slice('#entry-'.length));
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<EntryFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<AddEntrySheetHandle>(null);

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        const json = await res.json();
        if (json.tasks) setTasks(json.tasks);
      } catch {
        // network error — show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    const subscription = supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            try {
              const res = await fetch(`/api/tasks/${payload.new.id}`);
              const json = await res.json();
              const fresh = json.task as Task;
              setTasks((prev) =>
                prev.map((t) => (t.id === fresh.id ? fresh : t))
              );
            } catch {
              setTasks((prev) =>
                prev.map((t) => (t.id === payload.new.id ? { ...t, ...(payload.new as Task) } : t))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // On mount, if URL carries an entry deep-link, force list view.
  // Kept as an effect (not lazy state init) so SSR and first client render
  // agree on `view='cards'` — flipping happens post-mount.
  useEffect(() => {
    if (readEntryHash()) setView('list');
  }, []);

  useEffect(() => {
    if (loading) return;
    const id = readEntryHash();
    if (!id) return;
    const el = document.getElementById(`entry-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(id);
    const t = setTimeout(() => setHighlightedId(null), 2200);
    return () => clearTimeout(t);
  }, [loading, tasks, view]);

  useEffect(() => {
    function onHashChange() {
      const id = readEntryHash();
      if (!id) return;
      setView('list');
      const el = document.getElementById(`entry-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2200);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="h-dvh overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8">
      {/* Blur backdrop — mobile only, behind sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] sm:hidden"
          style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Add entry sheet — always in DOM so ref is available for synchronous focus */}
      <AddEntrySheet ref={sheetRef} open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* + FAB — mobile only */}
      <button
        onClick={() => {
          setSheetOpen(true);
          sheetRef.current?.focus(); // synchronous in tap handler — iOS opens keyboard
        }}
        className="sm:hidden fixed bottom-8 right-8 z-[50] w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95 hover:scale-110"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 28,
          lineHeight: 1,
        }}
      >
        +
      </button>

      <div className="max-w-3xl w-full mx-auto flex flex-col h-full">

        <div className="py-5 flex items-center justify-end shrink-0">
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex-1 overflow-hidden pb-4">
          {loading ? (
            <div className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div
              className="text-center p-8 rounded-xl mt-12"
              style={{
                color: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              No tasks yet. Double tap{' '}
              <kbd
                className="px-2 py-1 rounded mx-1 text-xs"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                Control
              </kbd>{' '}
              to capture one.
            </div>
          ) : view === 'cards' ? (
            <CardStack
              tasks={tasks.filter((t) => t.entry_type !== 'thought')}
              onDeleteTask={handleDeleteTask}
            />
          ) : (
            <StreamView
              tasks={tasks}
              filter={filter}
              search={search}
              selectedTags={selectedTags}
              highlightedId={highlightedId}
              onFilterChange={(f) => {
                setFilter(f);
                if (f === 'tasks') setSelectedTags([]);
              }}
              onSearchChange={setSearch}
              onToggleTag={(tag) =>
                setSelectedTags((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                )
              }
              onDeleteTask={handleDeleteTask}
            />
          )}
        </div>

      </div>
    </div>
  );
}

interface StreamViewProps {
  tasks: Task[];
  filter: EntryFilter;
  search: string;
  selectedTags: string[];
  highlightedId: string | null;
  onFilterChange: (f: EntryFilter) => void;
  onSearchChange: (s: string) => void;
  onToggleTag: (tag: string) => void;
  onDeleteTask: (id: string) => void;
}

function StreamView({
  tasks,
  filter,
  search,
  selectedTags,
  highlightedId,
  onFilterChange,
  onSearchChange,
  onToggleTag,
  onDeleteTask,
}: StreamViewProps) {
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.entry_type !== 'thought') continue;
      for (const tag of t.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === 'tasks' && t.entry_type === 'thought') return false;
      if (filter === 'thoughts' && t.entry_type !== 'thought') return false;

      if (selectedTags.length > 0) {
        if (t.entry_type !== 'thought') return false;
        const taskTags = t.tags ?? [];
        if (!selectedTags.every((tag) => taskTags.includes(tag))) return false;
      }

      if (needle && !t.input.toLowerCase().includes(needle)) return false;

      return true;
    });
  }, [tasks, filter, search, selectedTags]);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <FilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onToggleTag={onToggleTag}
      />

      <div
        className="text-xs font-medium mb-6 flex items-center justify-between uppercase tracking-widest"
        style={{ color: 'rgba(255,255,255,0.18)' }}
      >
        <span>Stream</span>
        <span>{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center p-8 rounded-xl"
          style={{
            color: 'rgba(255,255,255,0.22)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          Nothing matches the current filter.
        </div>
      ) : (
        filtered.map((entry) => {
          const isHighlighted = highlightedId === entry.id;
          return (
            <div
              key={entry.id}
              id={`entry-${entry.id}`}
              className="rounded-xl transition-shadow"
              style={{
                boxShadow: isHighlighted
                  ? '0 0 0 2px rgba(220,38,38,0.45), 0 0 24px rgba(220,38,38,0.25)'
                  : 'none',
              }}
            >
              {entry.entry_type === 'thought' ? (
                <ThoughtCard task={entry} onDelete={onDeleteTask} />
              ) : (
                <TaskCard task={entry} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
