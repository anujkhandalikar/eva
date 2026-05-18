import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';
import { THOUGHT_TAGS } from '@/lib/openai';

const ACTIVE_STATUSES = new Set(['pending', 'running', 'needs_approval', 'needs_otp']);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body?.entry_type !== 'thought') {
      return NextResponse.json(
        {
          error:
            'Only task → thought reclassification is supported. Use /promote to turn a thought into a task.',
        },
        { status: 400 }
      );
    }

    const rawTags = Array.isArray(body.tags) ? body.tags : [];
    const tags = rawTags
      .filter((t: unknown): t is string => typeof t === 'string')
      .filter((t: string) => (THOUGHT_TAGS as readonly string[]).includes(t))
      .slice(0, 3);

    const { data: source, error: srcErr } = await supabase
      .from('tasks')
      .select('id, status, entry_type')
      .eq('id', id)
      .single();

    if (srcErr) throw srcErr;

    if (source.entry_type === 'thought') {
      return NextResponse.json({ task: source });
    }

    if (ACTIVE_STATUSES.has(source.status)) {
      await inngest.send({ name: 'task/cancelled', data: { id } });
    }

    const { data: updated, error: updErr } = await supabase
      .from('tasks')
      .update({
        entry_type: 'thought',
        status: 'captured',
        tags,
        result_summary: null,
        result_full: null,
        error_reason: null,
        requires_approval: false,
        approved: false,
        proposed_cart: null,
        calendar_action: null,
        calendar_event_id: null,
        proposed_message: null,
        classification_confidence: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    return NextResponse.json({ task: updated });
  } catch (error: unknown) {
    console.error('reclassify route error', error);
    let message = 'Unknown error';
    if (error instanceof Error) message = error.message;
    else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
