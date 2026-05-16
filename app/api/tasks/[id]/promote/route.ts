import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let extra = '';
    try {
      const body = await req.json();
      if (body && typeof body.extra === 'string') extra = body.extra.trim();
    } catch {
      // empty body is fine
    }

    const { data: source, error: srcErr } = await supabase
      .from('tasks')
      .select('id, input, entry_type')
      .eq('id', id)
      .single();

    if (srcErr) throw srcErr;
    if (source.entry_type !== 'thought') {
      return NextResponse.json(
        { error: 'Only thoughts can be promoted' },
        { status: 400 }
      );
    }

    const newInput = extra ? `${source.input}\n\n${extra}` : source.input;

    const { data: created, error: insErr } = await supabase
      .from('tasks')
      .insert([
        {
          input: newInput,
          status: 'pending',
          entry_type: 'task',
          tags: [],
          requires_approval: false,
          approved: false,
        },
      ])
      .select()
      .single();

    if (insErr) throw insErr;

    await inngest.send({
      name: 'task/created',
      data: { id: created.id, input: created.input },
    });

    // Best-effort link — non-critical audit trail
    await supabase
      .from('tasks')
      .update({ promoted_to_task_id: created.id })
      .eq('id', source.id);

    return NextResponse.json({ task: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
