'use client';

import React, { useState } from 'react';

interface OtpInputProps {
  taskId: string;
}

export default function OtpInput({ taskId }: OtpInputProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!otp.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to submit OTP');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400 italic">
        OTP submitted — logging in…
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-2"
    >
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Enter the OTP sent to your phone to log into Blinkit.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="6-digit OTP"
          className="flex-1 px-3 py-2 rounded-xl border border-[#EDE8E2] dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100 text-sm outline-none focus:border-orange-300 dark:focus:border-orange-700 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || otp.length < 4}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#D97756' }}
        >
          {loading ? '…' : 'Submit'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </form>
  );
}
