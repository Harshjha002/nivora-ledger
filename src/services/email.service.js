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


const sendTransactionEmail = async (
    userEmail,
    name,
    amount,
    toAccount
) => {
    const subject = "Transaction Successful - Nivora Ledger";

    const text = `
Hello ${name},

Your transaction has been completed successfully.

Transaction Details:
Amount: ₹${amount}
To Account: ${toAccount}
Status: COMPLETED

If you did not authorize this transaction, please contact support immediately.

Regards,
Nivora Ledger
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transaction Successful</title>
</head>

<body>
    <h2>Transaction Successful</h2>

    <p>Hello ${name},</p>

    <p>
        Your transaction has been completed successfully.
    </p>

    <h3>Transaction Details</h3>

    <p><strong>Amount:</strong> ₹${amount}</p>
    <p><strong>To Account:</strong> ${toAccount}</p>
    <p><strong>Status:</strong> COMPLETED</p>

    <p>
        If you did not authorize this transaction,
        please contact support immediately.
    </p>

    <p>
        Regards,<br>
        <strong>Nivora Ledger</strong>
    </p>
</body>
</html>
`;

    return sendEmail(
        userEmail,
        subject,
        text,
        html
    );
};

const sendTransactionFailedEmail = async (
    userEmail,
    name,
    amount,
    toAccount
) => {
    const subject = "Transaction Failed - Nivora Ledger";

    const text = `
Hello ${name},

Unfortunately, your transaction could not be completed.

Transaction Details:
Amount: ₹${amount}
To Account: ${toAccount}
Status: FAILED

No successful transfer was completed for this transaction.

If you believe this is an error, please contact support.

Regards,
Nivora Ledger
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transaction Failed</title>
</head>

<body>
    <h2>Transaction Failed</h2>

    <p>Hello ${name},</p>

    <p>
        Unfortunately, your transaction could not be completed.
    </p>

    <h3>Transaction Details</h3>

    <p><strong>Amount:</strong> ₹${amount}</p>
    <p><strong>To Account:</strong> ${toAccount}</p>
    <p><strong>Status:</strong> FAILED</p>

    <p>
        No successful transfer was completed for this transaction.
    </p>

    <p>
        If you believe this is an error, please contact support.
    </p>

    <p>
        Regards,<br>
        <strong>Nivora Ledger</strong>
    </p>
</body>
</html>
`;

    return sendEmail(userEmail, subject, text, html);
};

module.exports = {
  sendEmail,
  sendRegistrationEmail,
  sendTransactionEmail,
  sendTransactionFailedEmail
};
