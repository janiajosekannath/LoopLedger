const nodemailer = require('nodemailer');

let _transporter = null;

const getTransporter = async () => {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Use Ethereal for local dev
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Using Ethereal test email account:', testAccount.user);
  }

  return _transporter;
};

const sendMail = async ({ to, subject, html, text, attachments }) => {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@loopledger.dev',
    to,
    subject,
    html,
    text,
    attachments,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('Email preview URL:', previewUrl);
  }

  return { messageId: info.messageId, previewUrl };
};

module.exports = { sendMail };
