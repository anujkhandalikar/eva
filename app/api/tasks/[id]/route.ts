import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (typeof body?.input !== 'string') {
      return NextResponse.json({ error: 'input (string) is required' }, { status: 400 });
    }

    const trimmed = body.input.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'input cannot be empty' }, { status: 400 });
    }
    if (trimmed.length > 4000) {
      return NextResponse.json({ error: 'input too long' }, { status: 400 });
    }

    const { data: existing, error: readErr } = await supabase
      .from('tasks')
      .select('id, entry_type')
      .eq('id', id)
      .single();
    if (readErr) throw readErr;

    if (existing.entry_type !== 'thought') {
      return NextResponse.json(
        { error: 'Only thoughts can be edited in place. Use /rerun for tasks.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ input: trimmed })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
