import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { computeNextRunAt } from '@/lib/scheduler';

type PatchBody = {
  enabled?: boolean;
  cron_expr?: string | null;
  payload?: Record<string, unknown>;
  next_run_at?: string | null;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (body.payload) update.payload = body.payload;
    if (body.cron_expr !== undefined) {
      update.cron_expr = body.cron_expr;
      if (body.cron_expr) {
        update.next_run_at = computeNextRunAt(body.cron_expr).toISOString();
      }
    }
    if (body.next_run_at !== undefined) update.next_run_at = body.next_run_at;

    // Re-enabling a row whose next_run_at is null: recompute from cron if available
    if (body.enabled === true && update.next_run_at === undefined) {
      const { data: existing } = await supabase
        .from('scheduled_tasks')
        .select('cron_expr, run_once, next_run_at')
        .eq('id', id)
        .single();
      if (existing && !existing.next_run_at && !existing.run_once && existing.cron_expr) {
        update.next_run_at = computeNextRunAt(existing.cron_expr).toISOString();
      }
    }

    const { data, error } = await supabase
      .from('scheduled_tasks')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ scheduled: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabase.from('scheduled_tasks').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
