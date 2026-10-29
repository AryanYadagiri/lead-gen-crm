import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  let effectiveCc: string[] = [];
  let effectiveBcc: string[] = [];
  let toRecipient = '';

  try {
    const body = await request.json();
    const { to, subject, body: emailBody, smtp, cc, bcc, ccList, bccList } = body;
    toRecipient = to ? String(to).trim() : '';

    if (!toRecipient || !subject || !emailBody) {
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

    const parseRecipients = (raw: any): string[] => {
      if (!raw) return [];
      const list = Array.isArray(raw) ? raw : String(raw).split(/[,;]/);
      return list
        .map((e: any) => String(e).trim().replace(/^[<]+|[>]+$/g, ''))
        .filter((e: string) => e.length > 0 && e.includes('@'));
    };

    effectiveCc = parseRecipients(ccList || cc);
    effectiveBcc = parseRecipients(bccList || bcc);

    const mailOptions: Record<string, any> = {
      from: fromName ? `"${fromName}" <${user}>` : user,
      to: toRecipient,
      subject,
      text: emailBody,
    };

    // Empty check safeguard: Only set CC or BCC headers if array has valid addresses
    if (effectiveCc.length > 0) {
      mailOptions.cc = effectiveCc;
    }
    if (effectiveBcc.length > 0) {
      mailOptions.bcc = effectiveBcc;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(
      `[Email Dispatch] Successfully sent email to ${toRecipient} (CC: ${effectiveCc.length > 0 ? JSON.stringify(effectiveCc) : 'none'}, BCC: ${effectiveBcc.length > 0 ? JSON.stringify(effectiveBcc) : 'none'}). ` +
      `Dispatch accepted by SMTP server: ${JSON.stringify(info.accepted)}, rejected: ${JSON.stringify(info.rejected)}, Message ID: ${info.messageId}, SMTP Response: ${info.response}`
    );

    return NextResponse.json({
      success: true,
      message: `Email successfully delivered to ${toRecipient}`,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      smtpResponse: info.response,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      `[Email Dispatch] Failed to dispatch email to ${toRecipient || 'unknown'} (CC: ${effectiveCc.length > 0 ? JSON.stringify(effectiveCc) : 'none'}, BCC: ${effectiveBcc.length > 0 ? JSON.stringify(effectiveBcc) : 'none'}):`,
      error
    );
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch email' },
      { status: 500 }
    );
  }
}
