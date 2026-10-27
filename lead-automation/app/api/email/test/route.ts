import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, pass, host = 'smtp.hostinger.com', port = 465 } = body;

    if (!user || !pass) {
      return NextResponse.json(
        { success: false, error: 'Email (user) and password are required to test connection.' },
        { status: 400 }
      );
    }

    const parsedPort = parseInt(String(port), 10);
    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: parsedPort,
      secure: parsedPort === 465,
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: `SMTP authentication successful for ${user}!`,
    });
  } catch (error: any) {
    console.error('[SMTP Test Connection Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'SMTP Authentication failed. Please check credentials or host/port.',
      },
      { status: 400 }
    );
  }
}
