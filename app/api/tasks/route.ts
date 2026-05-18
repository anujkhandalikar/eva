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
    const entryType = searchParams.get('entry_type');

    if (entryType === 'thought') {
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('entry_type', 'thought')
        .select('id');
      if (error) throw error;
      return NextResponse.json({ count: data.length });
    }

    const allowed = ['failed', 'done', 'pending'];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const statuses = status === 'pending' ? ['pending', 'needs_approval'] : [status];

    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .in('status', statuses)
      .eq('entry_type', 'task')
      .select('id');

    if (error) throw error;

    return NextResponse.json({ count: data.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const THOUGHT_BUCKET = 'thought-images';

export async function POST(req: Request) {
  try {
    const submitToken = process.env.SUBMIT_TOKEN;
    if (submitToken) {
      const provided = req.headers.get('x-submit-token');
      if (provided !== submitToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const contentType = req.headers.get('content-type') ?? '';

    // ── Multipart path — image thought capture ──
    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();
      const rawInput = form.get('input');
      const input = typeof rawInput === 'string' ? rawInput.trim() : '';
      const file = form.get('image');
      const forceType = form.get('force_type');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'image is required for multipart' }, { status: 400 });
      }
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'file must be an image' }, { status: 400 });
      }

      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(THOUGHT_BUCKET)
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(THOUGHT_BUCKET).getPublicUrl(path);
      const imageUrl = publicUrlData.publicUrl;

      const needsCaption = input.length === 0;
      const row: Record<string, unknown> = {
        input,
        status: needsCaption ? 'pending' : 'done',
        requires_approval: false,
        approved: false,
        image_url: imageUrl,
      };
      if (forceType === 'thought') row.entry_type = 'thought';

      const { data, error } = await supabase
        .from('tasks')
        .insert([row])
        .select()
        .single();
      if (error) throw error;

      if (needsCaption) {
        await inngest.send({
          name: 'thought/image-uploaded',
          data: { id: data.id, image_url: imageUrl },
        });
      }

      return NextResponse.json({ task: data });
    }

    // ── JSON path — existing flow ──
    const { input, entry_type } = await req.json();

    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    const isThought = entry_type === 'thought';

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          input,
          status: isThought ? 'done' : 'pending',
          requires_approval: false,
          approved: false,
          ...(isThought ? { entry_type: 'thought' } : {}),
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (!isThought) {
      await inngest.send({
        name: 'task/created',
        data: {
          id: data.id,
          input: data.input,
        },
      });
    }

    return NextResponse.json({ task: data });
  } catch (error: any) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
