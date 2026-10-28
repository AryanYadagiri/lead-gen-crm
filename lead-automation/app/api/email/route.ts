import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, smtp, cc, bcc } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const host = smtp?.host?.trim() || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = smtp?.port ? parseInt(String(smtp.port), 10) : parseInt(process.env.SMTP_PORT || '465', 10);
    const user = smtp?.user?.trim() || process.env.HOSTINGER_EMAIL;
    const pass = smtp?.pass?.trim() || process.env.HOSTINGER_PASSWORD;
    const fromName = smtp?.fromName?.trim() || process.env.EMAIL_FROM_NAME || 'MIAB Outreach';

    if (!user || !pass) {
      return NextResponse.json(
        { success: false, error: 'Email sender credentials (user & pass) are not configured. Please provide email credentials in campaign settings.' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    });

    const mailOptions: Record<string, any> = {
      from: fromName ? `"${fromName}" <${user}>` : user,
      to,
      subject,
      text: emailBody,
    };

    if (cc && typeof cc === 'string' && cc.trim()) {
      mailOptions.cc = cc.trim();
    }
    if (bcc && typeof bcc === 'string' && bcc.trim()) {
      mailOptions.bcc = bcc.trim();
    }

    const info = await transporter.sendMail(mailOptions);

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
