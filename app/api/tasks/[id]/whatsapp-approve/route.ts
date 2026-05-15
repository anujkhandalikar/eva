import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/lib/whatsapp';
import type { ProposedMessage } from '@/lib/whatsapp';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('task_type, status, proposed_message, requires_approval')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (data.task_type !== 'whatsapp') {
      return NextResponse.json({ error: 'Not a whatsapp task' }, { status: 400 });
    }
    if (data.status !== 'needs_approval') {
      return NextResponse.json({ error: 'Task is not awaiting approval' }, { status: 400 });
    }
    if (!data.requires_approval) {
      return NextResponse.json({ error: 'Task does not require approval' }, { status: 400 });
    }

    const proposed = data.proposed_message as ProposedMessage;
    if (!proposed?.recipient || !proposed?.body) {
      return NextResponse.json({ error: 'No proposed message stored on task' }, { status: 400 });
    }

    await sendMessage(proposed.recipient, proposed.body);

    await supabase
      .from('tasks')
      .update({
        status: 'done',
        approved: true,
        result_summary: `Sent to ${proposed.recipient_name}: "${proposed.body}"`,
      })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('tasks')
      .update({ status: 'failed', error_reason: message })
      .eq('id', id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
