'use client';

import React, { useEffect, useState } from 'react';
import { Task } from './TaskCard';
import SwipeableTaskCard from './SwipeableTaskCard';
import { Layers } from 'lucide-react';

interface CardStackProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
}

export default function CardStack({ tasks, onDeleteTask }: CardStackProps) {
  const [localQueue, setLocalQueue] = useState<Task[]>([]);

  // Sync prop tasks with local queue to preserve "kept" order but get updates
  useEffect(() => {
    setLocalQueue((prevQueue) => {
      // 1. Remove any tasks that are no longer in the props
      const validQueue = prevQueue.filter((qTask) => 
        tasks.some((t) => t.id === qTask.id)
      );

      // 2. Update existing tasks with fresh data from props
      const updatedQueue = validQueue.map((qTask) => {
        const freshTask = tasks.find((t) => t.id === qTask.id);
        return freshTask ? freshTask : qTask;
      });

      // 3. Add any brand new tasks from props to the front of the queue
      const newTasks = tasks.filter(
        (t) => !prevQueue.some((qTask) => qTask.id === t.id)
      );

      return [...newTasks, ...updatedQueue];
    });
  }, [tasks]);

  const handleKeep = (id: string) => {
    // Move to the back of the queue
    setTimeout(() => {
      setLocalQueue((prev) => {
        const taskToMove = prev.find((t) => t.id === id);
        if (!taskToMove) return prev;
        return [...prev.filter((t) => t.id !== id), taskToMove];
      });
    }, 200); // Small delay to let the swipe animation finish before re-ordering
  };

  const handleDelete = (id: string) => {
    // Immediately remove from local queue for snappy UI, then call parent to delete from DB
    setTimeout(() => {
      setLocalQueue((prev) => prev.filter((t) => t.id !== id));
      onDeleteTask(id);
    }, 200);
  };

  if (localQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
        <Layers size={48} className="opacity-20" />
        <p>No tasks left in the pile.</p>
      </div>
    );
  }

  // We only render the first few tasks for performance and visuals
  const visibleTasks = localQueue.slice(0, 3);

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-medium text-gray-500 mb-8 bg-[#1e1e1e] px-4 py-1.5 rounded-full border border-[#2a2a2a]">
        Card 1 of {localQueue.length}
      </div>
      
      <div className="relative w-full max-w-sm h-[400px]">
        {visibleTasks.map((task, index) => (
          <SwipeableTaskCard
            key={`${task.id}-${index}`} // Include index in key to force re-render/re-mount if order changes
            task={task}
            index={index}
            onDelete={handleDelete}
            onKeep={handleKeep}
          />
        )).reverse() /* Reverse so the first task (index 0) is rendered last and thus on top */}
      </div>

      <div className="mt-12 text-center text-xs text-gray-600 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center font-bold">←</span>
          <span>Swipe Left to Delete</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Swipe Right to Keep</span>
          <span className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center font-bold">→</span>
        </div>
      </div>
    </div>
  );
}
