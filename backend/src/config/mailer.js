const nodemailer = require('nodemailer');

let _transporter = null;

const getTransporter = async () => {
  if (_transporter) return _transporter;

  // In testing environment, use fast local mock transporter to avoid external port 587 timeouts
  if (process.env.NODE_ENV === 'test') {
    _transporter = {
      sendMail: async (mailOptions) => ({
        messageId: `<test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@loopledger.dev>`,
        response: '250 Test message queued',
        envelope: { from: mailOptions.from, to: mailOptions.to },
      }),
    };
    return _transporter;
  }

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
    try {
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
    } catch (err) {
      console.warn('Could not connect to Ethereal, falling back to mock logger:', err.message);
      _transporter = {
        sendMail: async (mailOptions) => ({
          messageId: `<dev-${Date.now()}@loopledger.dev>`,
          response: '250 Dev message logged',
        }),
      };
    }
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

  const previewUrl =
    typeof nodemailer.getTestMessageUrl === 'function' ? nodemailer.getTestMessageUrl(info) : null;
  const finalPreview = previewUrl || `https://ethereal.email/message/${info.messageId?.replace(/<|>/g, '') || 'preview'}`;

  return { messageId: info.messageId, previewUrl: finalPreview };
};

module.exports = { sendMail };
