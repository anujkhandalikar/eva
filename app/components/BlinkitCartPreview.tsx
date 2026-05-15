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
            <span style={{ color: 'rgba(255,255,255,0.75)' }}>
              {item.name}
              <span className="ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>×{item.quantity}</span>
            </span>
            <span className="tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.unit_price}</span>
          </div>
        ))}
        {missingItems.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="line-through" style={{ color: '#ef4444' }}>{item.requested}</span>
            <span className="text-xs" style={{ color: '#ef4444' }}>not found</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div
          className="flex justify-between items-center text-sm font-semibold pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Estimated total</span>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>₹{total}</span>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
      )}

      {foundItems.length > 0 && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          {loading ? 'Placing order…' : 'Place Order'}
        </button>
      )}
    </div>
  );
}
