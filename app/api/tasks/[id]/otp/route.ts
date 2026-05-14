import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { otp } = await req.json() as { otp: string };

    if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
      return NextResponse.json({ error: 'otp is required' }, { status: 400 });
    }

    await inngest.send({
      name: 'blinkit/otp.submitted',
      data: { taskId: id, otp: otp.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
