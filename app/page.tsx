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
    <div className="h-dvh overflow-hidden bg-[#121212] flex flex-col px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full mx-auto flex flex-col h-full">

        <div className="py-5 flex justify-center shrink-0">
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex-1 overflow-hidden pb-4">
          {loading ? (
            <div className="text-gray-500 animate-pulse">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-gray-500 text-center p-8 border border-dashed border-[#2a2a2a] rounded-xl mt-12">
              No tasks yet. Double tap <kbd className="px-2 py-1 bg-[#222] rounded mx-1 text-gray-300">Control</kbd> to capture one.
            </div>
          ) : view === 'cards' ? (
            <CardStack tasks={tasks} onDeleteTask={handleDeleteTask} />
          ) : (
            <div className="h-full overflow-y-auto flex flex-col">
              <div className="text-sm font-medium text-gray-500 mb-6 flex items-center justify-between">
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
