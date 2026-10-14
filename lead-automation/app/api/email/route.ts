import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    // Simulated email dispatch pipeline
    return NextResponse.json({
      success: true,
      message: `Email successfully queued for ${to}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid payload' },
      { status: 400 }
    );
  }
}
