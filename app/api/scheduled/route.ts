import { NextResponse } from 'next/server';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { computeNextRunAt } from '@/lib/scheduler';

type CreateBody = {
  action_type: string;
  payload: Record<string, unknown>;
  run_once: boolean;
  cron_expr?: string | null;
  next_run_at?: string | null; // ISO; required when run_once
  max_runs?: number | null;    // only meaningful when !run_once
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .order('next_run_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ scheduled: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBody;

    if (!body.action_type) {
      return NextResponse.json({ error: 'action_type required' }, { status: 400 });
    }
    if (!body.payload || typeof body.payload !== 'object') {
      return NextResponse.json({ error: 'payload required' }, { status: 400 });
    }

    // Validate media_path absolute if present
    const mediaPath = (body.payload as { media_path?: string }).media_path;
    if (mediaPath && !path.isAbsolute(mediaPath)) {
      return NextResponse.json({ error: 'media_path must be absolute' }, { status: 400 });
    }

    let nextRunAt: string | null = null;
    if (body.run_once) {
      if (!body.next_run_at) {
        return NextResponse.json({ error: 'next_run_at required for run_once' }, { status: 400 });
      }
      const d = new Date(body.next_run_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'next_run_at invalid' }, { status: 400 });
      }
      nextRunAt = d.toISOString();
    } else {
      if (!body.cron_expr) {
        return NextResponse.json({ error: 'cron_expr required when not run_once' }, { status: 400 });
      }
      try {
        nextRunAt = computeNextRunAt(body.cron_expr).toISOString();
      } catch (e) {
        return NextResponse.json({ error: `cron_expr invalid: ${(e as Error).message}` }, { status: 400 });
      }
    }

    let maxRuns: number | null = null;
    if (!body.run_once && body.max_runs != null) {
      if (!Number.isInteger(body.max_runs) || body.max_runs < 1) {
        return NextResponse.json({ error: 'max_runs must be a positive integer' }, { status: 400 });
      }
      maxRuns = body.max_runs;
    }

    const { data, error } = await supabase
      .from('scheduled_tasks')
      .insert({
        action_type: body.action_type,
        payload: body.payload,
        run_once: body.run_once,
        cron_expr: body.run_once ? null : body.cron_expr,
        next_run_at: nextRunAt,
        scheduled_for: nextRunAt,
        enabled: true,
        max_runs: maxRuns,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ scheduled: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
