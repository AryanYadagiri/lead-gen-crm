import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.HOSTINGER_EMAIL || 'aryan@miabagency.com';
    const pass = process.env.HOSTINGER_PASSWORD || 'Miabagency1@@';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Aryan | MIAB Agency'}" <${user}>`,
      to,
      subject,
      text: emailBody,
    });

    console.log('[Email Dispatch] Successfully sent email to', to, 'Message ID:', info.messageId);

    return NextResponse.json({
      success: true,
      message: `Email successfully delivered to ${to}`,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Email Dispatch] Failed to send email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch email' },
      { status: 500 }
    );
  }
}
