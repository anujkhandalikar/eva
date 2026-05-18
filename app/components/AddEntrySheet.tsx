'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const TOKEN_KEY = 'eva_submit_token';

const PLACEHOLDERS = [
  "Unleash me…",
  "I don't sleep. You do.",
  "Feed me a task.",
  "I'm bored. Fix that.",
  "Do your worst.",
  "Go on then.",
  "I've been waiting.",
  "Another one? Let's go.",
  "Brain full? Offload.",
  "I live for this.",
  "Say the thing.",
  "I'm faster than you.",
  "Speak.",
  "Hit me.",
  "No task too cursed.",
  "Finally.",
  "Clock's ticking.",
  "Bold of you to need help.",
  "I've seen worse. Probably.",
  "Task or I riot.",
];

export interface AddEntrySheetHandle {
  focus: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddEntrySheet = forwardRef<AddEntrySheetHandle, Props>(function AddEntrySheet({ open, onClose }, ref) {
  const [input, setInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<'captured' | 'error' | 'badtoken' | null>(null);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  // Called synchronously from the parent's tap handler — iOS respects this
  useImperativeHandle(ref, () => ({
    focus() {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (!saved) tokenRef.current?.focus();
      else textareaRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(TOKEN_KEY);
      setStoredToken(saved);
      setNeedsToken(!saved);
      setInput('');
      setTokenInput('');
      setFeedback(null);
      setPlaceholder(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
    }
  }, [open]);

  async function handleSubmit() {
    const t = storedToken || tokenInput.trim();
    if (!t || !input.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-submit-token': t },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setStoredToken(null);
        setNeedsToken(true);
        setTokenInput('');
        setFeedback('badtoken');
        return;
      }
      if (!res.ok) { setFeedback('error'); return; }

      if (!storedToken) localStorage.setItem(TOKEN_KEY, t);
      setFeedback('captured');
      setTimeout(() => onClose(), 700);
    } catch {
      setFeedback('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] sm:hidden"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        className="rounded-t-3xl px-5 pt-3 pb-8"
        style={{
          background: 'rgba(16,16,16,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-5">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Token gate */}
        {needsToken && (
          <div className="mb-4">
            <p
              className="eva-eyebrow mb-2"
              style={{ color: 'rgba(255,255,255,0.32)' }}
            >
              {feedback === 'badtoken' ? 'Wrong token — try again' : 'Enter access token'}
            </p>
            <input
              ref={tokenRef}
              type="password"
              value={tokenInput}
              onChange={(e) => { setTokenInput(e.target.value); setFeedback(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tokenInput.trim()) {
                  const t = tokenInput.trim();
                  setStoredToken(t);
                  setNeedsToken(false);
                  // Focus textarea synchronously — keyboard stays open
                  textareaRef.current?.focus();
                }
                if (e.key === 'Escape') onClose();
              }}
              placeholder="••••••••••••"
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${feedback === 'badtoken' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: 'rgba(255,255,255,0.88)',
                caretColor: 'white',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            />
          </div>
        )}

        {/* Main input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setFeedback(null); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          suppressHydrationWarning
          className="w-full rounded-xl px-4 py-3 resize-none outline-none"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: 'rgba(255,255,255,0.92)',
            caretColor: 'white',
            lineHeight: 1.45,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.022em',
          }}
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span
            className="eva-micro"
            style={{
              color: feedback === 'captured'
                ? 'rgba(34,197,94,0.9)'
                : feedback === 'error' || feedback === 'badtoken'
                  ? 'rgba(239,68,68,0.85)'
                  : 'rgba(255,255,255,0.22)',
            }}
          >
            {feedback === 'captured' && 'Captured ✓'}
            {feedback === 'error' && 'Something went wrong'}
            {feedback === 'badtoken' && 'Wrong token'}
          </span>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !input.trim()}
              className="eva-tab px-5 py-2 rounded-full disabled:opacity-30 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#111', fontWeight: 600 }}
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AddEntrySheet;
