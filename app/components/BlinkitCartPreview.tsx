'use client';

import React, { useState } from 'react';
import { CartItem } from './TaskCard';

interface BlinkitCartPreviewProps {
  cart: CartItem[];
  taskId: string;
}

export default function BlinkitCartPreview({ cart, taskId }: BlinkitCartPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foundItems = cart.filter((i) => !i.not_found);
  const missingItems = cart.filter((i) => i.not_found);

  const total = foundItems.reduce((sum, item) => {
    const price = parseInt(item.unit_price.replace(/[^\d]/g, ''), 10) || 0;
    return sum + price * item.quantity;
  }, 0);

  async function handleApprove(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to approve');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-1.5">
        {foundItems.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-stone-700 dark:text-stone-300">
              {item.name}
              <span className="text-stone-400 dark:text-stone-500 ml-1">×{item.quantity}</span>
            </span>
            <span className="text-stone-500 dark:text-stone-400 tabular-nums">{item.unit_price}</span>
          </div>
        ))}
        {missingItems.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-red-400 dark:text-red-500 line-through">{item.requested}</span>
            <span className="text-red-400 dark:text-red-500 text-xs">not found</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex justify-between items-center text-sm font-semibold border-t border-[#EDE8E2] dark:border-stone-700 pt-2">
          <span className="text-stone-600 dark:text-stone-400">Estimated total</span>
          <span className="text-stone-900 dark:text-stone-100">₹{total}</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {foundItems.length > 0 && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#D97756' }}
        >
          {loading ? 'Placing order…' : 'Place Order'}
        </button>
      )}
    </div>
  );
}
