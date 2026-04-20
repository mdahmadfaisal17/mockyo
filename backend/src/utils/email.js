const RESEND_API_URL = "https://api.resend.com/emails";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const resolveFromAddress = () => {
  const explicit = String(process.env.MAIL_FROM || "").trim();
  if (explicit) {
    const isPlainEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(explicit);
    const isFormatted = /^[^<>]+<[^<>@\s]+@[^<>@\s]+>$/.test(explicit.replace(/\s+/g, " "));

    if (isPlainEmail || isFormatted) return explicit;

    // Some dotenv parsers may strip angle brackets from `Name <email>`.
    const emailMatch = explicit.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      const email = emailMatch[0];
      const name = explicit.replace(email, "").trim();
      return name ? `${name} <${email}>` : email;
    }
  }

  const fromName = String(process.env.MAIL_FROM_NAME || "Mockyo").trim();
  return `${fromName} <onboarding@resend.dev>`;
};

export const sendEmail = async ({ to, subject, html }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is missing.");
    error.statusCode = 500;
    throw error;
  }

  const toEmail = String(to || "").trim();
  if (!toEmail) {
    const error = new Error("Recipient email is required.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    from: resolveFromAddress(),
    to: [toEmail],
    subject,
    html,
  };

  const replyTo = String(process.env.MAIL_REPLY_TO || "").trim();
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const error = new Error(`Failed to send email. ${bodyText || `Resend status ${response.status}`}`);
    error.statusCode = 502;
    throw error;
  }
};

export const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  const safeName = escapeHtml(name || "there");
  const safeVerificationUrl = escapeHtml(verificationUrl);

  await sendEmail({
    to,
    subject: "Verify your Mockyo account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Verify your email</h2>
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 16px;">Thanks for signing up. Click the button below to verify your email address.</p>
        <p style="margin: 0 0 18px;">
          <a
            href="${safeVerificationUrl}"
            style="display: inline-block; padding: 10px 16px; border-radius: 8px; background: #ff6b35; color: #111827; text-decoration: none; font-weight: 700;"
          >
            Verify Email
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">This link expires in 30 minutes.</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
};

export const sendChangePasswordOtpEmail = async ({ to, name, otp }) => {
  const safeName = escapeHtml(name || "there");
  const safeOtp = escapeHtml(String(otp));

  await sendEmail({
    to,
    subject: "Your Mockyo password change verification code",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Password Change Request</h2>
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 16px;">We received a request to change your Mockyo password. Use the verification code below to proceed.</p>
        <div style="margin: 0 0 20px; display: inline-block; padding: 14px 28px; border-radius: 10px; background: #1a1c2a; border: 2px solid #ff6b35; font-size: 28px; font-weight: 700; letter-spacing: 10px; color: #ff6b35; font-family: monospace;">${safeOtp}</div>
        <p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">This code expires in 10 minutes.</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">If you did not request this, please ignore this email. Your password will not change.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const safeName = escapeHtml(name || "there");
  const safeResetUrl = escapeHtml(resetUrl);

  await sendEmail({
    to,
    subject: "Reset your Mockyo password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Reset your password</h2>
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 16px;">We received a request to reset your Mockyo password. Click the button below to set a new password.</p>
        <p style="margin: 0 0 18px;">
          <a
            href="${safeResetUrl}"
            style="display: inline-block; padding: 10px 16px; border-radius: 8px; background: #ff6b35; color: #111827; text-decoration: none; font-weight: 700;"
          >
            Reset Password
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">This link expires in 1 hour.</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendNewMockupEmail = async ({ to, mockupTitle, mockupUrl, thumbnailUrl }) => {
  const safeTitle = escapeHtml(mockupTitle || "New Mockup");
  const safeMockupUrl = escapeHtml(mockupUrl || "https://mockyo.com/mockups");
  const safeThumbnail = thumbnailUrl ? escapeHtml(thumbnailUrl) : null;

  await sendEmail({
    to,
    subject: `New mockup drop: ${safeTitle} — Mockyo`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#09090d;font-family:'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090d;padding:40px 16px;">
          <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#101119;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

              <!-- Header -->
              <tr>
                <td style="padding:28px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="background:linear-gradient(135deg,#ff6b35,#ff8c42);border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                              <span style="font-size:18px;font-weight:800;color:#0d0d13;line-height:40px;">M</span>
                            </td>
                            <td style="padding-left:12px;vertical-align:middle;">
                              <span style="font-size:18px;font-weight:700;color:#f4f4f5;letter-spacing:-0.3px;">Mockyo</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <span style="background:rgba(255,107,53,0.12);border:1px solid rgba(255,107,53,0.25);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:#ff6b35;letter-spacing:0.08em;text-transform:uppercase;">New Drop</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Thumbnail -->
              ${safeThumbnail ? `
              <tr>
                <td style="padding:0;">
                  <img src="${safeThumbnail}" alt="${safeTitle}" width="560" style="width:100%;max-width:560px;display:block;border-radius:0;object-fit:cover;max-height:300px;" />
                </td>
              </tr>` : ""}

              <!-- Body -->
              <tr>
                <td style="padding:32px 32px 8px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#ff6b35;letter-spacing:0.18em;text-transform:uppercase;">Fresh Mockup Drop</p>
                  <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#f4f4f5;line-height:1.3;">${safeTitle}</h1>
                  <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:rgba(244,244,245,0.62);">A brand-new mockup just landed on Mockyo. Apply your design to it instantly with our built-in editor &mdash; no Photoshop needed.</p>

                  <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#ff6b35,#ff8c42);border-radius:12px;">
                        <a href="${safeMockupUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#0d0d13;text-decoration:none;letter-spacing:0.01em;">View Mockup &rarr;</a>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
                    <tr>
                      <td style="padding:14px 18px;background:rgba(255,255,255,0.03);">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;color:rgba(244,244,245,0.5);">Free to download</td>
                            <td align="right" style="font-size:13px;font-weight:600;color:#34d399;">Free</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 18px;border-top:1px solid rgba(255,255,255,0.05);">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;color:rgba(244,244,245,0.5);">Editor</td>
                            <td align="right" style="font-size:13px;font-weight:600;color:rgba(244,244,245,0.8);">Built-in &amp; instant</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.07);">
                  <p style="margin:0 0 8px;font-size:12px;color:rgba(244,244,245,0.3);line-height:1.6;">You are receiving this email because you subscribed to Mockyo drop alerts.</p>
                  <p style="margin:0;font-size:12px;color:rgba(244,244,245,0.25);">Mockyo &mdash; your design, instantly on mockups.</p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
};
