'use client';

import React, { useState } from 'react';
import { CartItem } from './TaskCard';

interface BlinkitCartPreviewProps {
  cart: CartItem[];
  taskId: string;
}

function ImageTile({ item }: { item: CartItem }) {
  const [failed, setFailed] = useState(false);

  if (item.not_found || !item.image_url || failed) {
    return (
      <div
        className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center text-lg"
        style={{ background: 'rgba(255,255,255,0.06)' }}
        title={item.not_found ? `${item.requested} — not found` : item.name}
      >
        {item.not_found ? '?' : '📦'}
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt={item.name}
      title={item.name}
      onError={() => setFailed(true)}
      className="shrink-0 w-16 h-16 rounded-xl object-cover"
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  );
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

      {/* Image carousel */}
      {cart.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {cart.map((item, i) => (
            <ImageTile key={i} item={item} />
          ))}
        </div>
      )}

      {/* Item list */}
      <div className="flex flex-col gap-1.5">
        {foundItems.map((item, i) => (
          <div key={i} className="flex justify-between items-center eva-body">
            <span style={{ color: 'rgba(255,255,255,0.78)' }}>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: 'rgba(255,255,255,0.78)' }}
                >
                  {item.name}
                </a>
              ) : (
                item.name
              )}
              <span className="ml-1 eva-num" style={{ color: 'rgba(255,255,255,0.38)' }}>×{item.quantity}</span>
            </span>
            <span className="eva-num" style={{ color: 'rgba(255,255,255,0.48)', fontWeight: 500 }}>{item.unit_price}</span>
          </div>
        ))}
        {missingItems.map((item, i) => (
          <div key={i} className="flex justify-between items-center eva-body">
            <span className="line-through" style={{ color: '#ef4444' }}>{item.requested}</span>
            <span className="eva-micro" style={{ color: '#ef4444' }}>not found</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div
          className="flex justify-between items-center pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className="eva-tab" style={{ color: 'rgba(255,255,255,0.48)' }}>Estimated total</span>
          <span className="eva-num" style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: 700 }}>₹{total}</span>
        </div>
      )}

      {error && (
        <p className="eva-micro" style={{ color: '#ef4444' }}>{error}</p>
      )}

      {foundItems.length > 0 && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="w-full py-2.5 rounded-xl eva-tab transition-opacity disabled:opacity-50"
          style={{ background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          {loading ? 'Placing order…' : 'Place Order'}
        </button>
      )}
    </div>
  );
}
