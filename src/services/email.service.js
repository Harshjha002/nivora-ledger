require("dotenv").config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify email configuration
transporter.verify((error) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Generic email function
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Nivora Ledger" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", info.messageId);

    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// Registration email
const sendRegistrationEmail = async (userEmail, name) => {
  const subject = "Welcome to Nivora Ledger";

  const text = `
Hello ${name},

Welcome to Nivora Ledger!

Your account has been successfully created.

Thank you for joining us.

Regards,
Nivora Ledger
`;

  const html = `
<!DOCTYPE html>
<html>
<body>
    <h2>Welcome to Nivora Ledger, ${name}!</h2>

    <p>Your account has been successfully created.</p>

    <p>Thank you for joining Nivora Ledger.</p>

    <br>

    <p>Regards,<br>
    <strong>Nivora Ledger</strong></p>
</body>
</html>
`;

  return sendEmail(userEmail, subject, text, html);
};

module.exports = {
  sendEmail,
  sendRegistrationEmail,
};
