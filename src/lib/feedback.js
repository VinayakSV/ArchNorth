// Feedback goes by email, so the static site needs no backend. `mailto:` depends on the visitor having a
// mail app set up (often not true on Windows desktops), so we also offer Gmail / Outlook.com web compose
// links, which work in any browser where the visitor is signed in, plus copy-to-clipboard fallbacks.
export const FEEDBACK_EMAIL = 'archnorth.learn@gmail.com';
export const FEEDBACK_SUBJECT_PREFIX = '[ArchNorth Feedback]';

const enc = encodeURIComponent;

/** Subject and plain-text body (with \n line breaks) for a feedback email. */
export function feedbackMessage({ topic, pageUrl } = {}) {
  const lines = [];
  if (topic) lines.push(`Tutorial: ${topic}`);
  if (pageUrl) lines.push(`Page: ${pageUrl}`);
  if (lines.length) lines.push('');
  lines.push('What looks wrong, confusing, or missing?', '', '', '(Optional) How would you improve it?', '', '');
  return { subject: `${FEEDBACK_SUBJECT_PREFIX} ${topic || 'General'}`, body: lines.join('\n') };
}

/** The visitor's default email app. RFC 6068 asks for CRLF line breaks in mailto bodies. */
export const mailtoLink = ({ subject, body }) =>
  `mailto:${FEEDBACK_EMAIL}?subject=${enc(subject)}&body=${enc(body.replace(/\n/g, '\r\n'))}`;

/** Gmail's web compose window (opens in a new tab; asks to sign in if needed). */
export const gmailLink = ({ subject, body }) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(FEEDBACK_EMAIL)}&su=${enc(subject)}&body=${enc(body)}`;

/** Outlook.com's web compose window (personal Microsoft accounts). */
export const outlookLink = ({ subject, body }) =>
  `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(FEEDBACK_EMAIL)}&subject=${enc(subject)}&body=${enc(body)}`;

/** Everything needed to send the email by hand, for pasting into any mail service. */
export const plainTextMessage = ({ subject, body }) => `To: ${FEEDBACK_EMAIL}\nSubject: ${subject}\n\n${body}`;
