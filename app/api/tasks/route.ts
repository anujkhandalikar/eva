import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tasks: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const allowed = ['failed', 'done', 'pending'];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const statuses = status === 'pending' ? ['pending', 'needs_approval'] : [status];

    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .in('status', statuses)
      .select('id');

    if (error) throw error;

    return NextResponse.json({ count: data.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          input,
          status: 'pending',
          requires_approval: false,
          approved: false,
        }
      ])
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
  } catch (error: any) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
