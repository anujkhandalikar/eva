'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TaskCard, { Task } from '@/app/components/TaskCard';
import ViewToggle, { ViewMode } from '@/app/components/ViewToggle';
import CardStack from '@/app/components/CardStack';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('eva-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('eva-theme', next ? 'dark' : 'light');
  }

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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t))
            );
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

        <div className="py-5 flex items-center justify-between shrink-0">
          <ViewToggle view={view} onChange={setView} />
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:text-stone-500 dark:hover:text-stone-300 dark:hover:bg-stone-800 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-hidden pb-4">
          {loading ? (
            <div className="text-stone-400 animate-pulse text-sm">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-stone-400 dark:text-stone-500 text-center p-8 border border-dashed border-[#EDE8E2] dark:border-stone-700 rounded-2xl mt-12 bg-white/40 dark:bg-stone-900/40 backdrop-blur-sm">
              No tasks yet. Double tap <kbd className="px-2 py-1 bg-white/80 dark:bg-stone-800 border border-[#EDE8E2] dark:border-stone-700 rounded-lg mx-1 text-stone-600 dark:text-stone-300 text-xs shadow-sm">Control</kbd> to capture one.
            </div>
          ) : view === 'cards' ? (
            <CardStack tasks={tasks} onDeleteTask={handleDeleteTask} />
          ) : (
            <div className="h-full overflow-y-auto flex flex-col">
              <div className="text-sm font-medium text-stone-400 dark:text-stone-500 mb-6 flex items-center justify-between">
                <span>Current Tasks</span>
                <span>Showing {tasks.length} tasks</span>
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
