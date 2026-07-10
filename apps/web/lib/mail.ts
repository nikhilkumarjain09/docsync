import nodemailer from 'nodemailer';

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Clean, modern responsive HTML template for authentication verification
 */
/**
 * Clean, modern responsive HTML template for authentication verification
 */
function getVerificationHtml(email: string, otp: string, verifyUrl: string): string {
  const otpSection = otp ? `
        <p>Enter the following verification code in your browser to activate your account:</p>
        <div class="otp-container">
          ${otp}
        </div>
        <p style="margin-top: 24px; margin-bottom: 16px; font-size: 14px; color: #6b7280; text-align: center;">— OR —</p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f9fafb;
      padding-top: 48px;
      padding-bottom: 48px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%);
      padding: 32px;
      text-align: center;
    }
    .logo-text {
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0;
    }
    .content {
      padding: 40px 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
      color: #111827;
      letter-spacing: -0.025em;
      text-align: center;
    }
    p {
      font-size: 15px;
      line-height: 24px;
      color: #4b5563;
      margin-top: 0;
      margin-bottom: 24px;
      text-align: center;
    }
    .otp-container {
      background-color: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 18px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 0.25em;
      color: #1e1b4b;
      text-align: center;
      margin: 24px 0;
    }
    .btn-container {
      margin-top: 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .btn-verify {
      display: inline-block;
      background-color: #311042;
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(49, 16, 66, 0.2), 0 2px 4px -1px rgba(49, 16, 66, 0.1);
      transition: background-color 0.15s ease;
    }
    .fallback-container {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
      word-break: break-all;
    }
    .fallback-title {
      font-size: 12px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
      text-align: left;
    }
    .fallback-url {
      font-size: 13px;
      color: #6366f1;
      text-decoration: none;
      display: block;
      text-align: left;
    }
    .footer {
      padding: 32px;
      border-top: 1px solid #e5e7eb;
      background-color: #f9fafb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      line-height: 18px;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
    /* Dark Mode support where clients allow */
    @media (prefers-color-scheme: dark) {
      body, .wrapper {
        background-color: #0f172a !important;
      }
      .container {
        background-color: #1e293b !important;
        border-color: #334155 !important;
      }
      h1 {
        color: #f8fafc !important;
      }
      p {
        color: #cbd5e1 !important;
      }
      .otp-container {
        background-color: #0f172a !important;
        border-color: #334155 !important;
        color: #f8fafc !important;
      }
      .fallback-container {
        background-color: #0f172a !important;
      }
      .fallback-url {
        color: #818cf8 !important;
      }
      .footer {
        border-color: #334155 !important;
        background-color: #1e293b !important;
        color: #64748b !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-text">DocSync</div>
      </div>
      <div class="content">
        <h1>Verify your email address</h1>
        <p>Thank you for signing up for DocSync! To activate your account and start co-authoring documents in real-time, please verify your email address.</p>
        
        ${otpSection}

        <div class="btn-container">
          <a href="${verifyUrl}" class="btn-verify" target="_blank">Verify Email Address</a>
        </div>

        <p>This verification request is valid for <strong>24 hours</strong>. If you did not sign up for a DocSync account, you can safely ignore this email.</p>
        
        <div class="fallback-container">
          <div class="fallback-title">Button not working? Copy this URL:</div>
          <a href="${verifyUrl}" class="fallback-url" target="_blank">${verifyUrl}</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0; font-size: 12px;">© ${new Date().getFullYear()} DocSync. Secure real-time document collaboration.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends mail via Resend REST API or fallback SMTP server, or falls back to console logger
 */
async function sendMail({ to, subject, html }: SendMailParams) {
  const from = process.env.EMAIL_FROM || 'DocSync <onboarding@resend.dev>';

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend API Error (${res.status}): ${errText}`);
      }

      console.log(`[MAIL] Successfully sent verification email to ${to} via Resend.`);
      return;
    } catch (error) {
      console.error('[MAIL] Failed to send via Resend API. Attempting SMTP fallback...', error);
    }
  }

  // 2. SMTP Transport
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      console.log(`[MAIL] Successfully sent verification email to ${to} via SMTP.`);
      return;
    } catch (error) {
      console.error('[MAIL] Failed to send via SMTP. Falling back to Console logging...', error);
    }
  }

  // 3. Console fallback (always available for local dev ease-of-use)
  console.warn('\n==================================================');
  console.warn(`[MAIL DEV FALLBACK] Verification email for: ${to}`);
  console.warn(`Subject: ${subject}`);
  console.warn(`Verification Link: ${html.match(/href="([^"]+)"/)?.[1] || ''}`);
  console.warn('==================================================\n');
}

/**
 * Public method to send verification emails
 */
export async function sendVerificationEmail(email: string, token: string) {
  let otp = '';
  if (token.includes(':')) {
    const parts = token.split(':');
    otp = parts[0];
  }

  let baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }
  const verifyUrl = `${baseUrl}/verify?token=${token}`;
  const html = getVerificationHtml(email, otp, verifyUrl);

  await sendMail({
    to: email,
    subject: otp ? `${otp} is your DocSync verification code` : 'Verify your email address - DocSync',
    html,
  });
}
