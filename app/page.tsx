'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import TaskCard, { Task } from '@/app/components/TaskCard';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTasks(data);
      }
      setLoading(false);
    };

    fetchTasks();

    // Real-time subscription
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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Eva</h1>
          <div className="text-sm text-gray-500 font-medium">Validation Build</div>
        </header>
        
        {loading ? (
          <div className="text-gray-500 animate-pulse">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-gray-500 mt-12 text-center p-8 border border-dashed border-[#2a2a2a] rounded-xl">
            No tasks yet. Double tap <kbd className="px-2 py-1 bg-[#222] rounded mx-1 text-gray-300">Control</kbd> to capture one.
          </div>
        ) : (
          <div className="flex flex-col">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
