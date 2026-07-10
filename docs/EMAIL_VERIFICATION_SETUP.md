# Email Verification Setup Guide (No Domain Required)

This guide describes how to configure and verify the email verification system for DocSync. **You do NOT need to own a custom domain to set this up or test it.**

---

## 1. Overview

DocSync uses a secure, rate-limited email verification flow during user signup. The system works as follows:

1. **Signup**: When a user registers via the credentials form, an unverified user account is created.
2. **Token Generation**: A cryptographically secure random token is generated (`crypto.randomBytes(32)`) and stored in the database with a 24-hour expiration.
3. **Delivery**: The email utility sends a styled HTML verification message with the verification link (`/verify?token=...`).
4. **Activation**: Clicking the verification link updates the user's account (`emailVerified: new Date()`) and deletes the token to prevent reuse.
5. **Login Block**: Unverified users trying to sign in are blocked and automatically redirected to a verification pending screen with a rate-limited "Resend Link" button.

---

## 2. Setup Options (No Domain Required)

You have three options to run and test email verification without owning a custom domain:

### Option A: Resend Testing Sandbox (Recommended for quick API testing)

Resend allows you to send emails using their default testing domain (`onboarding@resend.dev`) to your **own registered account email address** without configuring any DNS or domain settings.

1. **Create Account**: Register a free account on [Resend](https://resend.com). The email address you use to sign up becomes your authorized testing email.
2. **Generate API Key**: Go to the Resend dashboard -> "API Keys" -> Click "Create API Key" with "Sending Access" -> Copy the key.
3. **Configure Environment Variables**:
   - Set `RESEND_API_KEY` to your key.
   - Set `EMAIL_FROM` to `"DocSync <onboarding@resend.dev>"`.
4. **Test**: You can now sign up a user in DocSync using **your Resend account email address**. Resend will deliver the email directly to your inbox. _(Note: In Sandbox mode, you can only send emails to yourself)._

### Option B: Local SMTP Sandbox via Mailtrap (Recommended for full multi-user testing)

Mailtrap provides a fake SMTP server for development. It intercepts all outgoing emails and lets you view them in a browser dashboard. It does not require any domain setup and can send mock emails to any address.

1. **Create Account**: Register a free account on [Mailtrap](https://mailtrap.io).
2. **Get Credentials**: Go to "Email Sandbox" -> "Inboxes" -> select "My Inbox" -> copy the SMTP credentials (host, port, username, password).
3. **Configure Environment Variables**:
   - Leave `RESEND_API_KEY` empty/commented out.
   - Set SMTP environment variables (see below).
4. **Test**: You can now sign up with **any email address** (e.g. `test@example.com`). The email will instantly appear in your Mailtrap inbox dashboard.

### Option C: Console Fallback (Zero Setup / Offline)

If neither Resend nor SMTP is configured, the application automatically falls back to printing verification links directly to your console.

1. **Configure**: Leave `RESEND_API_KEY` and `SMTP_HOST` empty or undefined.
2. **Test**: Sign up with any email address. Check your **terminal/server logs** to find the verification link, copy-paste it into your browser, and confirm activation.

---

## 3. Environment Variables Configuration

Add the following variables to your `.env` (local) or your hosting platform's dashboard (production):

```bash
# ==============================================================================
# EMAIL VERIFICATION CONFIGURATION
# ==============================================================================

# NextAuth Base URL (Used to construct the verification link)
NEXTAUTH_URL="http://localhost:3000"

# The sender email address.
# - For Resend Sandbox (Option A), this MUST be: "DocSync <onboarding@resend.dev>"
# - For Mailtrap/Console (Option B/C), this can be anything.
EMAIL_FROM="DocSync <onboarding@resend.dev>"


# OPTION A: RESEND SANDBOX API
# If this key is present, Resend will be used to send to your registered email.
RESEND_API_KEY="re_123456789abcdef"


# OPTION B: SMTP SANDBOX (e.g. Mailtrap)
# Comment out RESEND_API_KEY and configure these to use SMTP intercept.
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="your_mailtrap_smtp_user"
SMTP_PASS="your_mailtrap_smtp_password"
SMTP_SECURE="false"
```

---

## 4. Local Development Testing Flow

1. **Register**: Go to `/signup` and fill out the registration form.
2. **Inbox Check**:
   - If using **Resend Sandbox**: check the inbox of your Resend account email.
   - If using **Mailtrap**: check your Mailtrap dashboard inbox.
   - If using **Console**: check your server terminal output.
3. **Verify**: Click the link (`http://localhost:3000/verify?token=...`). The page will display "Email Verified!".
4. **Log In**: Click "Log In to DocSync" and authenticate successfully.

---

## 5. Troubleshooting

#### 1. "Sending limit exceeded" or "Unauthorized recipient" (Resend Option)

- This happens if you try to sign up a user in Resend Sandbox mode with an email address other than your own Resend login email. To send to anyone, you must verify a custom domain under "Domains" in the Resend dashboard.

#### 2. Verification Link Expired

- Verification links expire in 24 hours. Users will see a warning. They can enter their email on the `/verify` page and click "Send Verification Link" to get a fresh link instantly.
