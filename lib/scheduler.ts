import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { supabase } from './supabase';
import { handleWhatsappSend, WhatsappSendPayload } from './handlers/whatsapp-send';

const TZ = 'Asia/Kolkata';

export type ScheduledTask = {
  id: string;
  enabled: boolean;
  run_once: boolean;
  cron_expr: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  max_runs: number | null;
  run_count: number;
};

const handlers: Record<string, (payload: unknown) => Promise<void>> = {
  whatsapp_send: (p) => handleWhatsappSend(p as WhatsappSendPayload),
};

export function computeNextRunAt(cronExpr: string, from: Date = new Date()): Date {
  const it = CronExpressionParser.parse(cronExpr, { currentDate: from, tz: TZ });
  return it.next().toDate();
}

function endOfIstDay(d: Date): Date {
  // 23:59:59.999 IST on the same calendar day as `d` interpreted in IST.
  const istParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = istParts.find(p => p.type === 'year')!.value;
  const m = istParts.find(p => p.type === 'month')!.value;
  const day = istParts.find(p => p.type === 'day')!.value;
  // IST is +05:30, no DST.
  return new Date(`${y}-${m}-${day}T23:59:59.999+05:30`);
}

async function dispatch(row: ScheduledTask): Promise<void> {
  const handler = handlers[row.action_type];
  if (!handler) throw new Error(`Unknown action_type: ${row.action_type}`);
  await handler(row.payload);
}

async function processRow(row: ScheduledTask): Promise<void> {
  const now = new Date();
  const scheduled = row.next_run_at ? new Date(row.next_run_at) : now;

  // Claim: atomically null out next_run_at so concurrent tick can't grab it.
  const { data: claimed, error: claimErr } = await supabase
    .from('scheduled_tasks')
    .update({ next_run_at: null })
    .eq('id', row.id)
    .eq('next_run_at', row.next_run_at)
    .select()
    .single();

  if (claimErr || !claimed) {
    // Lost the race or row changed; skip.
    return;
  }

  // End-of-IST-day skip.
  const cutoff = endOfIstDay(scheduled);
  if (now > cutoff) {
    await finalize(row, now, 'missed', `Past end-of-day (${cutoff.toISOString()}) for scheduled ${row.next_run_at}`);
    console.log(`[scheduler] ${row.id} MISSED (past EOD)`);
    return;
  }

  let status: 'done' | 'failed' = 'done';
  let errMsg: string | null = null;
  try {
    await dispatch(row);
  } catch (e) {
    status = 'failed';
    errMsg = (e as Error).message;
    console.error(`[scheduler] ${row.id} FAILED:`, errMsg);
  }

  await finalize(row, now, status, errMsg);
}

async function finalize(
  row: ScheduledTask,
  now: Date,
  status: 'done' | 'failed' | 'missed',
  errMsg: string | null,
): Promise<void> {
  const newRunCount = row.run_count + 1;
  const hitCap = row.max_runs != null && newRunCount >= row.max_runs;

  const nextEnabled = row.run_once || hitCap ? false : row.enabled;
  const nextRunAt = row.run_once || hitCap || !row.cron_expr
    ? null
    : computeNextRunAt(row.cron_expr, now).toISOString();

  await supabase
    .from('scheduled_tasks')
    .update({
      last_run_at: now.toISOString(),
      last_status: status,
      last_error: errMsg,
      enabled: nextEnabled,
      next_run_at: nextRunAt,
      run_count: newRunCount,
    })
    .eq('id', row.id);

  console.log(
    `[scheduler] ${row.id} ${status.toUpperCase()} (${newRunCount}${row.max_runs ? `/${row.max_runs}` : ''})${
      hitCap ? ' — cap reached, disabled' : nextRunAt ? ` next=${nextRunAt}` : ''
    }`,
  );
}

export async function tick(): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[scheduler] tick query failed:', error.message);
    return;
  }
  if (!data || data.length === 0) return;

  for (const row of data as ScheduledTask[]) {
    try {
      await processRow(row);
    } catch (e) {
      console.error(`[scheduler] processRow ${row.id} crashed:`, (e as Error).message);
    }
  }
}

export async function runNow(id: string): Promise<{ status: 'done' | 'failed'; error: string | null }> {
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(`Row ${id} not found`);

  const row = data as ScheduledTask;
  let status: 'done' | 'failed' = 'done';
  let errMsg: string | null = null;
  try {
    await dispatch(row);
  } catch (e) {
    status = 'failed';
    errMsg = (e as Error).message;
  }
  await finalize(row, new Date(), status, errMsg);
  return { status, error: errMsg };
}

declare global {
  // eslint-disable-next-line no-var
  var __evaSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (globalThis.__evaSchedulerStarted) {
    console.log('[scheduler] already started, skipping');
    return;
  }
  globalThis.__evaSchedulerStarted = true;

  console.log('[scheduler] starting cron loop (every minute, IST)');
  cron.schedule('* * * * *', () => {
    tick().catch((e) => console.error('[scheduler] tick crashed:', (e as Error).message));
  }, { timezone: TZ });

  // Fire one tick immediately on boot so missed runs catch up without waiting up to 60s.
  tick().catch((e) => console.error('[scheduler] boot tick crashed:', (e as Error).message));
}
