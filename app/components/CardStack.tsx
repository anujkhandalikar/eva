'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Task } from './TaskCard';
import SwipeableTaskCard from './SwipeableTaskCard';
import { Layers } from 'lucide-react';

interface CardStackProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
}

export default function CardStack({ tasks, onDeleteTask }: CardStackProps) {
  const [localQueue, setLocalQueue] = useState<Task[]>([]);
  const [swipeCount, setSwipeCount] = useState(0);

  useEffect(() => {
    setLocalQueue((prevQueue) => {
      const validQueue = prevQueue.filter((qTask) =>
        tasks.some((t) => t.id === qTask.id)
      );
      const updatedQueue = validQueue.map((qTask) => {
        const freshTask = tasks.find((t) => t.id === qTask.id);
        return freshTask ? freshTask : qTask;
      });
      const newTasks = tasks.filter(
        (t) => !prevQueue.some((qTask) => qTask.id === t.id)
      );
      return [...newTasks, ...updatedQueue];
    });
  }, [tasks]);

  const handleKeep = (id: string) => {
    setSwipeCount((c) => c + 1);
    setTimeout(() => {
      setLocalQueue((prev) => {
        const taskToMove = prev.find((t) => t.id === id);
        if (!taskToMove) return prev;
        return [...prev.filter((t) => t.id !== id), taskToMove];
      });
    }, 200);
  };

  const handleDelete = (id: string) => {
    setSwipeCount((c) => c + 1);
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

  const visibleTasks = localQueue.slice(0, 3);
  const currentPos = (swipeCount % localQueue.length) + 1;

  return (
    <div className="flex flex-col items-center h-full">
      <div className="relative w-full flex-1 min-h-0">
        <AnimatePresence>
          {visibleTasks.map((task, index) => (
            <SwipeableTaskCard
              key={task.id}
              task={task}
              index={index}
              onDelete={handleDelete}
              onKeep={handleKeep}
            />
          )).reverse()}
        </AnimatePresence>
      </div>
      <div className="shrink-0 py-3 text-sm text-gray-600 tabular-nums">
        {currentPos}/{localQueue.length}
      </div>
    </div>
  );
}
