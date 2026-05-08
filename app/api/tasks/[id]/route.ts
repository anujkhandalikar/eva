import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
