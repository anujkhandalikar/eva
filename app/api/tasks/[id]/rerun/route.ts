import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'pending',
        result_summary: null,
        result_full: null,
        error_reason: null,
        requires_approval: false,
        approved: false,
        task_type: 'research',
        proposed_cart: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await inngest.send({
      name: 'task/created',
      data: {
        id: data.id,
        input: data.input,
      },
    });

    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
