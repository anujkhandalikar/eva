'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import TaskCard, { Task } from '@/app/components/TaskCard';
import ViewToggle, { ViewMode } from '@/app/components/ViewToggle';
import CardStack from '@/app/components/CardStack';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');

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

  return (
    <div className="h-dvh overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8">
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
            <CardStack tasks={tasks} onDeleteTask={handleDeleteTask} />
          ) : (
            <div className="h-full overflow-y-auto flex flex-col">
              <div
                className="text-xs font-medium mb-6 flex items-center justify-between uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                <span>Tasks</span>
                <span>{tasks.length}</span>
              </div>
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
