# Email Verification Setup Guide

This guide describes how to configure and verify the email verification system for DocSync in both local development and production.

---

## 1. Overview

DocSync uses a secure, rate-limited email verification flow during user signup. The system works as follows:

1. **Signup**: When a user registers via the credentials form, an unverified user account is created.
2. **Token Generation**: A cryptographically secure random token is generated (`crypto.randomBytes(32)`) and stored in the database with a 24-hour expiration.
3. **Delivery**: The email utility sends a styled HTML verification message with the verification link (`/verify?token=...`).
4. **Activation**: Clicking the verification link updates the user's account (`emailVerified: new Date()`) and deletes the token to prevent reuse.
5. **Login Block**: Unverified users trying to sign in are blocked and automatically redirected to a verification pending screen with a rate-limited "Resend Link" button.

---

## 2. Required Accounts & Services

To run email verification in production, you must set up an email provider. We recommend **Resend** for its developer experience, free tier, and easy integration.

### Resend Setup (Production Option)

1. **Create Account**: Register an account on [Resend](https://resend.com).
2. **Add Domain**: Under "Domains", add your custom domain (e.g., `docsync.dev`).
3. **Configure DNS**:
   Add the generated DNS records to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.):
   - **DKIM** (TXT records)
   - **SPF** (TXT records)
4. **Generate API Key**: Go to "API Keys" -> Click "Create API Key" with "Sending Access" -> Copy the key.

---

## 3. Environment Variables

Add the following variables to your `.env` (local) or your hosting platform's dashboard (production):

```bash
# ==============================================================================
# EMAIL VERIFICATION CONFIGURATION
# ==============================================================================

# The sender email address. Must be verified/authorized by your provider.
# In local development without Resend, this can be anything.
EMAIL_FROM="DocSync <onboarding@resend.dev>"

# Option A: Resend API Key (Recommended for Staging/Production)
# Obtain this from the Resend Dashboard. If present, it will be used.
RESEND_API_KEY="re_123456789abcdef"

# Option B: SMTP Configuration (Fallback for local dev or custom SMTP provider)
# If RESEND_API_KEY is not defined, the system falls back to this configuration.
# To test locally using Mailtrap/Mailpit, configure these:
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="your_mailtrap_smtp_user"
SMTP_PASS="your_mailtrap_smtp_password"
SMTP_SECURE="false" # set to "true" if using SSL (typically port 465)

# NextAuth Base URL (Used to construct the verification link)
NEXTAUTH_URL="http://localhost:3000"
```

---

## 4. Local Development Testing

If neither `RESEND_API_KEY` nor `SMTP_HOST` are configured, the application falls back to a **Console Logger**.

### How to test with Console Logger (No Setup Required):

1. Sign up a new user via the `/signup` page.
2. The UI will show the "Verify your email" screen.
3. Check your **terminal/console logs**. You will see a block like:
   ```text
   ==================================================
   [MAIL DEV FALLBACK] Verification email for: alice@docsync.dev
   Subject: Verify your email address - DocSync
   Verification Link: http://localhost:3000/verify?token=abc123xyz...
   ==================================================
   ```
4. Copy-paste the verification link into your browser.
5. You will see the "Email Verified!" success page. Click "Log In" and log in successfully!

### How to test with Mailtrap/Mailpit (SMTP Setup):

1. Create a free account on [Mailtrap](https://mailtrap.io).
2. Create an Email Sandbox inbox and copy the SMTP credentials.
3. Add the `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` settings to your `.env` file.
4. Sign up a new user. The email will be sent and will appear in your Mailtrap inbox.

---

## 5. Production Deployment Checklist

Before deploying to production, verify:

- [ ] Your custom sending domain is fully verified on Resend (DKIM, SPF status: "Verified").
- [ ] `EMAIL_FROM` matches your verified sending domain (e.g. `no-reply@yourdomain.com`).
- [ ] `RESEND_API_KEY` is added to production environment variables.
- [ ] `NEXTAUTH_URL` is set to your production domain (e.g. `https://docsync.dev`).
- [ ] SSL/HTTPS is enabled (verification pages require HTTPS for cookie/session security).

---

## 6. Troubleshooting

#### 1. Email not arriving (Spam folder)

- Ensure your sending domain has correct SPF, DKIM, and DMARC records configured in DNS.
- During testing, check the spam/junk folder.

#### 2. Expired Verification Link

- Verification links expire in 24 hours. Users will see a warning. They can enter their email on the `/verify` page and click "Send Verification Link" to get a fresh link instantly.

#### 3. Rate Limit Warnings

- Resend token action has a 60-second rate limit to prevent SMTP spamming. If requested too frequently, users will be prompted to wait.
