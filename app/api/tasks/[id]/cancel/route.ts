import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', approved: false, result_summary: 'Cancelled by user' })
      .eq('id', id)
      .eq('status', 'needs_approval');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
