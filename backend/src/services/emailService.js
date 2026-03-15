import nodemailer from "nodemailer";

// ─── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,   // Gmail App Password (16-char, no spaces)
  },
});

// ─── Helper — format ISO date to human-readable ───────────────────────────────
const formatInterviewTime = (isoString) => {
  const date = new Date(isoString);
  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour:     "2-digit",
      minute:   "2-digit",
      timeZoneName: "short",
    }),
  };
};

// ─── HTML template ────────────────────────────────────────────────────────────
const buildInterviewEmailHtml = ({
  candidateName,
  jobTitle,
  startTime,
  zoomJoinUrl,
}) => {
  const { date, time } = formatInterviewTime(startTime);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interview Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;">NexusHR · Recruitment</p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Interview Invitation</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 20px 0;font-size:16px;color:#374151;line-height:1.6;">
                Hi <strong style="color:#111827;">${candidateName}</strong>,
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#4b5563;line-height:1.7;">
                Congratulations on progressing to the interview stage! We're excited to invite you to a Zoom interview for the
                <strong style="color:#4f46e5;">${jobTitle}</strong> position.
              </p>

              <!-- Detail card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border:1px solid #e0e7ff;border-radius:10px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">

                    <!-- Date row -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="32" valign="top" style="padding-top:2px;">
                          <!-- Calendar icon (inline SVG) -->
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8"  y1="2" x2="8"  y2="6"/>
                            <line x1="3"  y1="10" x2="21" y2="10"/>
                          </svg>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Date</p>
                          <p style="margin:4px 0 0 0;font-size:15px;font-weight:600;color:#111827;">${date}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Time row -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="32" valign="top" style="padding-top:2px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Time</p>
                          <p style="margin:4px 0 0 0;font-size:15px;font-weight:600;color:#111827;">${time}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Platform row -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="32" valign="top" style="padding-top:2px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Platform</p>
                          <p style="margin:4px 0 0 0;font-size:15px;font-weight:600;color:#111827;">Zoom Video Call</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a
                      href="${zoomJoinUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      style="
                        display:inline-block;
                        padding:14px 36px;
                        background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
                        color:#ffffff;
                        font-size:15px;
                        font-weight:700;
                        text-decoration:none;
                        border-radius:8px;
                        letter-spacing:0.3px;
                        box-shadow:0 4px 14px rgba(79,70,229,0.4);
                      "
                    >
                      Join Zoom Interview
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;line-height:1.6;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px 0;word-break:break-all;">
                <a href="${zoomJoinUrl}" style="font-size:13px;color:#4f46e5;text-decoration:underline;">${zoomJoinUrl}</a>
              </p>

              <!-- Tips -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#92400e;">📋 Before the interview</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#78350f;line-height:1.8;">
                      <li>Test your camera and microphone in advance.</li>
                      <li>Find a quiet, well-lit location.</li>
                      <li>Join 2–3 minutes early to check your connection.</li>
                      <li>Have a copy of your resume handy.</li>
                    </ul>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#9ca3af;">
                This is an automated message from <strong style="color:#374151;">NexusHR</strong>.
              </p>
              <p style="margin:0;font-size:12px;color:#d1d5db;">
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
};

// ─── Exported send function ───────────────────────────────────────────────────
/**
 * Sends a formatted interview invitation email to the candidate.
 *
 * @param {Object} params
 * @param {string} params.candidateEmail  - Recipient address
 * @param {string} params.candidateName   - Used in greeting
 * @param {string} params.jobTitle        - Displayed in subject + body
 * @param {string} params.startTime       - ISO 8601 string
 * @param {string} params.zoomJoinUrl     - Zoom join URL for the candidate
 */
export const sendInterviewEmail = async ({
  candidateEmail,
  candidateName,
  jobTitle,
  startTime,
  zoomJoinUrl,
}) => {
  const { date, time } = formatInterviewTime(startTime);

  const mailOptions = {
    from:    `"NexusHR Recruitment" <${process.env.EMAIL_USER}>`,
    to:      candidateEmail,
    subject: `Interview Invitation — ${jobTitle}`,
    text:
      `Hi ${candidateName},\n\n` +
      `You have been invited to a Zoom interview for the ${jobTitle} position.\n\n` +
      `Date : ${date}\n` +
      `Time : ${time}\n\n` +
      `Join Zoom: ${zoomJoinUrl}\n\n` +
      `Best of luck!\nNexusHR Recruitment Team`,
    html: buildInterviewEmailHtml({
      candidateName,
      jobTitle,
      startTime,
      zoomJoinUrl,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[emailService] Interview email sent | to=${candidateEmail} | ` +
      `messageId=${info.messageId}`
    );
  } catch (err) {
    // Re-throw so the caller can decide whether to suppress or surface the error
    throw new Error(`Failed to send interview email to ${candidateEmail}: ${err.message}`);
  }
};


// ─── Tenant Welcome Email ─────────────────────────────────────────────────────

const buildTenantWelcomeHtml = ({ hrEmail,hrName, orgName, tempPassword, loginUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to NexusHR</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6c47ff 0%,#a259ff 100%);padding:40px 48px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Welcome to NexusHR</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Your organisation is ready</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 48px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">Hi <strong>${hrName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a4a6a;line-height:1.6;">
              Your organisation <strong>${orgName}</strong> has been successfully onboarded onto NexusHR.
              You have been assigned the <strong>HR Manager</strong> role. Use the credentials below to log in and get started.
            </p>

            <!-- Credentials card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;border:1px solid #e0d4ff;border-radius:8px;margin-bottom:32px;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6c47ff;text-transform:uppercase;letter-spacing:0.8px;">Login URL</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;">${loginUrl}</p>

                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6c47ff;text-transform:uppercase;letter-spacing:0.8px;">Email</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;">${hrEmail ?? hrName}</p>

                  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6c47ff;text-transform:uppercase;letter-spacing:0.8px;">Temporary Password</p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#1a1a2e;letter-spacing:2px;font-family:'Courier New',monospace;">${tempPassword}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#6c47ff;border-radius:8px;">
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Log In Now →</a>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#7a6000;">
                    <strong>Security:</strong> Please change your password immediately after your first login. Do not share these credentials with anyone.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f6f9;padding:24px 48px;text-align:center;border-top:1px solid #e8e8f0;">
            <p style="margin:0;font-size:12px;color:#9090a0;">© ${new Date().getFullYear()} NexusHR · This is an automated message, please do not reply.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;


/**
 * Sends a welcome email to the newly created HR Manager with their temp credentials.
 *
 * @param {Object} params
 * @param {string} params.hrEmail       - Recipient email address
 * @param {string} params.hrName        - HR Manager's first name
 * @param {string} params.orgName       - Organisation name
 * @param {string} params.tempPassword  - Plain-text temp password (before hashing)
 * @param {string} params.loginUrl      - Full URL to the login page
 */
export const sendTenantWelcomeEmail = async ({
  hrEmail,
  hrName,
  orgName,
  tempPassword,
  loginUrl,
}) => {
  await transporter.sendMail({
    from:    `"NexusHR" <${process.env.EMAIL_USER}>`,
    to:      process.env.EMAIL_TEST_USER || hrEmail,
    subject: `Welcome to NexusHR — Your ${orgName} account is ready`,
    html:    buildTenantWelcomeHtml({ hrEmail, hrName, orgName, tempPassword, loginUrl }),
  });
};