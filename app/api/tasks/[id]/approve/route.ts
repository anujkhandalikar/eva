import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('tasks')
      .select('task_type, status, proposed_cart')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (data.task_type !== 'blinkit_order') {
      return NextResponse.json({ error: 'Not a blinkit order task' }, { status: 400 });
    }
    if (data.status !== 'needs_approval') {
      return NextResponse.json({ error: 'Task is not awaiting approval' }, { status: 400 });
    }

    await inngest.send({
      name: 'blinkit/order.approved',
      data: { taskId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
