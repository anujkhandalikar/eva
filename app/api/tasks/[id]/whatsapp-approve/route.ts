import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/lib/whatsapp';
import type { ProposedMessage } from '@/lib/whatsapp';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Optional recipient override when the user picks a candidate on the card.
    let override: { recipient?: string; recipient_name?: string } = {};
    try {
      override = (await req.json()) as { recipient?: string; recipient_name?: string };
    } catch {
      // no JSON body — send to the originally proposed recipient
    }

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

    // Resolve the final recipient: an override is only honoured if it matches the
    // proposed recipient or one of the surfaced candidates — never an arbitrary
    // jid, so a picked alternative can't be tampered into texting a stranger.
    let recipient = proposed.recipient;
    let recipientName = proposed.recipient_name;
    if (override.recipient && override.recipient !== proposed.recipient) {
      const allowed = (proposed.candidates ?? []).find((c) => c.jid === override.recipient);
      if (!allowed) {
        return NextResponse.json({ error: 'Override recipient is not an offered candidate' }, { status: 400 });
      }
      recipient = allowed.jid;
      recipientName = allowed.name;
    }

    await sendMessage(recipient, proposed.body);

    await supabase
      .from('tasks')
      .update({
        status: 'done',
        approved: true,
        result_summary: `Sent to ${recipientName}: "${proposed.body}"`,
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
