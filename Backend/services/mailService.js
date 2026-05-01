const nodemailer = require("nodemailer");
const appError = require("../utils/appError");

let transporterPromise;

function getMailUsername() {
  return process.env.MAIL_USERNAME?.trim() || "";
}

function getMailPassword() {
  return (process.env.MAIL_PASSWORD || "").replace(/\s+/g, "");
}

function getMailFrom() {
  return process.env.MAIL_FROM?.trim() || getMailUsername();
}

function isMailConfigured() {
  return Boolean(getMailUsername() && getMailPassword());
}

async function getTransporter() {
  if (!isMailConfigured()) {
    throw appError("Password reset email is not configured on the server.", 500);
  }

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: getMailUsername(),
          pass: getMailPassword(),
        },
      })
    );
  }

  return transporterPromise;
}

async function sendPasswordResetOtp({ email, name, otp, expiresInMinutes = 10 }) {
  try {
    const transporter = await getTransporter();

    await transporter.sendMail({
      from: getMailFrom(),
      to: email,
      subject: "UniGuide AI password reset code",
      text: [
        `Hello ${name || "there"},`,
        "",
        "We received a request to reset your UniGuide AI password.",
        `Your verification code is ${otp}.`,
        `This code expires in ${expiresInMinutes} minutes.`,
        "",
        "If you did not request this change, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f1f35; line-height: 1.6;">
          <h2 style="margin-bottom: 12px;">UniGuide AI Password Reset</h2>
          <p>Hello ${name || "there"},</p>
          <p>We received a request to reset your UniGuide AI password.</p>
          <p style="margin: 20px 0;">
            <span style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #f0e9ff; color: #2d2a7b; font-size: 24px; font-weight: 700; letter-spacing: 4px;">
              ${otp}
            </span>
          </p>
          <p>This code expires in ${expiresInMinutes} minutes.</p>
          <p>If you did not request this change, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    transporterPromise = undefined;
    console.error("Failed to send password reset email", error);
    throw appError("Unable to send the password reset email right now. Please try again shortly.", 500);
  }
}

module.exports = {
  isMailConfigured,
  sendPasswordResetOtp,
};
