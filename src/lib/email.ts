import nodemailer from "nodemailer";

function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transport = buildTransport();

export async function sendOtpEmail(toEmail: string, code: string): Promise<void> {
  if (!transport) {
    console.log(
      `\n[email:dev-fallback] No SMTP configured. OTP code for ${toEmail} is: ${code}\n` +
        `Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in .env to send real emails.\n`
    );
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || "no-reply@skin-scan.local",
    to: toEmail,
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires in 5 minutes.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`,
  });
}
