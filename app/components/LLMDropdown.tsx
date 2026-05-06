'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Task } from './TaskCard';

interface LLMDropdownProps {
  task: Task;
}

export default function LLMDropdown({ task }: LLMDropdownProps) {
  const handleOpenClaude = () => {
    const prompt = `Task: ${task.input}\n\nResult: ${task.result_summary || 'No result summary'}`;
    // Copy to clipboard just in case the URL param doesn't work perfectly
    navigator.clipboard.writeText(prompt);

    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://claude.ai/new?q=${encodedPrompt}`;
    window.open(url, '_blank');
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleOpenClaude();
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
    >
      <Sparkles size={14} />
      Tell me more
    </button>
  );
}
