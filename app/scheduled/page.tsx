'use client';

import { useEffect, useState } from 'react';

type ScheduledTask = {
  id: string;
  created_at: string;
  enabled: boolean;
  run_once: boolean;
  cron_expr: string | null;
  action_type: string;
  payload: { recipient?: string; message?: string; media_path?: string };
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  max_runs: number | null;
  run_count: number;
};

const TZ = 'Asia/Kolkata';

type Frequency = 'hourly' | 'daily';

function to24h(hour12: number, ampm: 'AM' | 'PM'): number {
  if (hour12 === 12) return ampm === 'AM' ? 0 : 12;
  return ampm === 'AM' ? hour12 : hour12 + 12;
}

function buildCron(freq: Frequency, hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  if (freq === 'hourly') return `${minute} * * * *`;
  return `${minute} ${to24h(hour12, ampm)} * * *`;
}

function cronToFriendly(expr: string | null): string {
  if (!expr) return '—';
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, mon, dow] = parts;
  if (dom !== '*' || mon !== '*' || dow !== '*') return expr;
  if (h === '*') {
    return `Every hour at :${m.padStart(2, '0')}`;
  }
  const hn = parseInt(h, 10);
  const mn = parseInt(m, 10);
  if (Number.isNaN(hn) || Number.isNaN(mn)) return expr;
  const ampm = hn >= 12 ? 'PM' : 'AM';
  const h12 = hn === 0 ? 12 : hn > 12 ? hn - 12 : hn;
  return `Daily at ${h12}:${String(mn).padStart(2, '0')} ${ampm}`;
}

function istParts(d: Date): { date: string; hour12: number; minute: number; ampm: 'AM' | 'PM' } {
  // format date/time in IST regardless of host TZ
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  let h24 = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  if (h24 === 0) h24 = 12;
  else if (h24 > 12) h24 -= 12;
  return { date, hour12: h24, minute, ampm };
}

function todayIstDate(): string {
  return istParts(new Date()).date;
}

function addDaysIst(date: string, n: number): string {
  // date is yyyy-mm-dd IST. Convert to noon IST then add days, re-extract.
  const d = new Date(`${date}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return istParts(d).date;
}

function fmtIst(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function statusColor(s: string | null): string {
  if (s === 'done') return 'bg-green-100 text-green-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'missed') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

export default function ScheduledPage() {
  const [rows, setRows] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [runOnce, setRunOnce] = useState(true);
  const [freq, setFreq] = useState<Frequency>('daily');
  const [hour12, setHour12] = useState(11);
  const [minute, setMinute] = useState(11);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [oneShotDate, setOneShotDate] = useState<string>(todayIstDate());
  const [oneShotHour12, setOneShotHour12] = useState(11);
  const [oneShotMinute, setOneShotMinute] = useState(11);
  const [oneShotAmpm, setOneShotAmpm] = useState<'AM' | 'PM'>('AM');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [maxRuns, setMaxRuns] = useState(''); // string so empty = unlimited
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/scheduled');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'load failed');
      setRows(j.scheduled ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const payload: Record<string, string> = { recipient, message };
      if (mediaPath.trim()) payload.media_path = mediaPath.trim();

      const body: Record<string, unknown> = {
        action_type: 'whatsapp_send',
        payload,
        run_once: runOnce,
      };
      if (runOnce) {
        if (!oneShotDate) throw new Error('Pick a date');
        const h24 = to24h(oneShotHour12, oneShotAmpm);
        const hh = String(h24).padStart(2, '0');
        const mm = String(oneShotMinute).padStart(2, '0');
        body.next_run_at = `${oneShotDate}T${hh}:${mm}:00+05:30`;
      } else {
        body.cron_expr = buildCron(freq, hour12, minute, ampm);
        if (maxRuns.trim()) {
          const n = parseInt(maxRuns.trim(), 10);
          if (!Number.isInteger(n) || n < 1) throw new Error('Max runs must be a positive integer');
          body.max_runs = n;
        }
      }

      const r = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'create failed');

      setRecipient('');
      setMessage('');
      setMediaPath('');
      setOneShotDate(todayIstDate());
      setOneShotHour12(11);
      setOneShotMinute(11);
      setOneShotAmpm('AM');
      setMaxRuns('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/scheduled/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await load();
  }

  async function del(id: string) {
    if (!confirm('Delete this schedule?')) return;
    await fetch(`/api/scheduled/${id}`, { method: 'DELETE' });
    await load();
  }

  async function runNow(id: string) {
    if (!confirm('Fire this schedule now?')) return;
    const r = await fetch(`/api/scheduled/${id}/run-now`, { method: 'POST' });
    const j = await r.json();
    if (!r.ok) setErr(j.error ?? 'run-now failed');
    await load();
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Scheduled sends</h1>
      <p className="text-sm text-gray-600 mb-6">
        Times are IST. Creating a schedule = approval — Eva will send automatically.
      </p>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <form onSubmit={submit} className="mb-8 space-y-3 rounded border p-4">
        <h2 className="font-medium">New schedule</h2>

        <div className="flex gap-4 items-center text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={runOnce}
              onChange={() => setRunOnce(true)}
            />
            One-shot
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!runOnce}
              onChange={() => setRunOnce(false)}
            />
            Recurring (cron)
          </label>
        </div>

        {runOnce ? (
          <div className="space-y-2">
            <div className="text-sm">Fire at (IST)</div>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <input
                type="date"
                value={oneShotDate}
                min={todayIstDate()}
                onChange={(e) => setOneShotDate(e.target.value)}
                className="rounded border px-2 py-1"
              />
              <select
                value={oneShotHour12}
                onChange={(e) => setOneShotHour12(parseInt(e.target.value, 10))}
                className="rounded border px-2 py-1"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>:</span>
              <select
                value={oneShotMinute}
                onChange={(e) => setOneShotMinute(parseInt(e.target.value, 10))}
                className="rounded border px-2 py-1"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
              <select
                value={oneShotAmpm}
                onChange={(e) => setOneShotAmpm(e.target.value as 'AM' | 'PM')}
                className="rounded border px-2 py-1"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              <span className="text-xs text-gray-500">IST</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const p = istParts(new Date(Date.now() + 5 * 60_000));
                  setOneShotDate(p.date);
                  setOneShotHour12(p.hour12);
                  setOneShotMinute(p.minute);
                  setOneShotAmpm(p.ampm);
                }}
                className="rounded border px-2 py-1 hover:bg-gray-50"
              >
                +5 min
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = istParts(new Date(Date.now() + 60 * 60_000));
                  setOneShotDate(p.date);
                  setOneShotHour12(p.hour12);
                  setOneShotMinute(p.minute);
                  setOneShotAmpm(p.ampm);
                }}
                className="rounded border px-2 py-1 hover:bg-gray-50"
              >
                +1 hr
              </button>
              <button
                type="button"
                onClick={() => {
                  setOneShotDate(todayIstDate());
                  setOneShotHour12(11);
                  setOneShotMinute(11);
                  setOneShotAmpm('AM');
                }}
                className="rounded border px-2 py-1 hover:bg-gray-50"
              >
                Today 11:11 AM
              </button>
              <button
                type="button"
                onClick={() => {
                  setOneShotDate(addDaysIst(todayIstDate(), 1));
                  setOneShotHour12(11);
                  setOneShotMinute(11);
                  setOneShotAmpm('AM');
                }}
                className="rounded border px-2 py-1 hover:bg-gray-50"
              >
                Tomorrow 11:11 AM
              </button>
              <button
                type="button"
                onClick={() => {
                  setOneShotDate(addDaysIst(todayIstDate(), 1));
                  setOneShotHour12(9);
                  setOneShotMinute(0);
                  setOneShotAmpm('AM');
                }}
                className="rounded border px-2 py-1 hover:bg-gray-50"
              >
                Tomorrow 9 AM
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex gap-4 items-center text-sm">
                <span>Repeat:</span>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={freq === 'daily'} onChange={() => setFreq('daily')} />
                  Daily
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={freq === 'hourly'} onChange={() => setFreq('hourly')} />
                  Hourly
                </label>
              </div>

              {freq === 'daily' ? (
                <div className="flex gap-2 items-center text-sm">
                  <span>At:</span>
                  <select
                    value={hour12}
                    onChange={(e) => setHour12(parseInt(e.target.value, 10))}
                    className="rounded border px-2 py-1"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value, 10))}
                    className="rounded border px-2 py-1"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <select
                    value={ampm}
                    onChange={(e) => setAmpm(e.target.value as 'AM' | 'PM')}
                    className="rounded border px-2 py-1"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <span className="text-xs text-gray-500">IST</span>
                </div>
              ) : (
                <div className="flex gap-2 items-center text-sm">
                  <span>Every hour at minute:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value, 10))}
                    className="rounded border px-2 py-1"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                      <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="text-xs text-gray-500">
                {cronToFriendly(buildCron(freq, hour12, minute, ampm))}
              </div>
            </div>

            <label className="block text-sm">
              Max runs (optional — stops after N fires; leave blank for unlimited)
              <input
                type="number"
                min={1}
                value={maxRuns}
                onChange={(e) => setMaxRuns(e.target.value)}
                className="mt-1 block w-32 rounded border px-2 py-1"
                placeholder="e.g. 5"
              />
            </label>
          </>
        )}

        <label className="block text-sm">
          Recipient (group or contact name; uses WhatsApp resolver)
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1"
            placeholder="Noticing Beauty"
          />
        </label>

        <label className="block text-sm">
          Message / caption
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1"
            rows={3}
          />
        </label>

        <label className="block text-sm">
          Image path (absolute, optional)
          <input
            type="text"
            value={mediaPath}
            onChange={(e) => setMediaPath(e.target.value)}
            className="mt-1 block w-full rounded border px-2 py-1 font-mono"
            placeholder="/Users/anujk/eva/scheduled-media/noticing-beauty/day1.jpg"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create schedule'}
        </button>
      </form>

      <h2 className="font-medium mb-3">All schedules</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No schedules yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Message</th>
                <th className="py-2 pr-3">Image</th>
                <th className="py-2 pr-3">Last run</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Enabled</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.run_once ? (
                      <span className="text-xs text-gray-500">one-shot</span>
                    ) : (
                      <span className="text-xs">{cronToFriendly(r.cron_expr)}</span>
                    )}
                    <div className="text-xs text-gray-600">next: {fmtIst(r.next_run_at)}</div>
                    {!r.run_once && (
                      <div className="text-xs text-gray-500">
                        runs: {r.run_count}{r.max_runs != null ? `/${r.max_runs}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.payload?.recipient ?? '—'}</td>
                  <td className="py-2 pr-3 max-w-xs truncate">{r.payload?.message ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs font-mono max-w-xs truncate">
                    {r.payload?.media_path ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs">{fmtIst(r.last_run_at)}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${statusColor(r.last_status)}`}>
                      {r.last_status ?? 'pending'}
                    </span>
                    {r.last_error && (
                      <div className="mt-1 text-xs text-red-700 max-w-xs truncate" title={r.last_error}>
                        {r.last_error}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-2 pr-3 space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => runNow(r.id)}
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Run now
                    </button>
                    <button
                      onClick={() => del(r.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
