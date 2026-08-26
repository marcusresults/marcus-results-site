// ---------------------------------------------------------------------------
// Spam scoring
// ---------------------------------------------------------------------------
// Every signal below was taken from junk that actually landed in the inbox from
// this form. Only the honeypots and a foreign Origin block on their own —
// everything else adds to a score, so no single mis-read can bin a real lead.
//
//   score >= BLOCK_AT  dropped silently (the bot is told "ok" so it stops retrying)
//   score >= FLAG_AT   still emailed, subject prefixed, kept out of the CRM
//   below FLAG_AT      ordinary lead, delivered exactly as before
const BLOCK_AT = 6;
const FLAG_AT = 4;

// Marcus sells to Australian trades, so a number that cannot be dialled in
// Australia is the strongest single signal this form has. Every spam
// submission to date has failed this; no genuine lead should.
function isAustralianPhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+61')) p = '0' + p.slice(3);
  else if (p.startsWith('0061')) p = '0' + p.slice(4);
  else if (/^61[2-9]\d{8}$/.test(p)) p = '0' + p.slice(2);
  p = p.replace(/\D/g, '');

  return (
    /^0[2378]\d{8}$/.test(p) || // landline with area code
    /^0[45]\d{8}$/.test(p) ||   // mobile
    /^[45]\d{8}$/.test(p) ||    // mobile with the leading 0 dropped
    /^1[38]00\d{6}$/.test(p) || // 1300 / 1800
    /^13\d{4}$/.test(p) ||      // 13 xx xx
    /^[2-9]\d{7}$/.test(p)      // local landline, no area code
  );
}

// Filler numbers bots reach for.
function isFillerPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length < 7) return false;
  if (/^(\d)\1+$/.test(d)) return true;         // 0000000000000
  if (/555\d{4}$/.test(d) && d.length >= 10) return true; // reserved US 555 range
  if (/^8\d{10}$/.test(d)) return true;         // 11-digit RU-style
  const block = d.slice(0, 3);                  // 1201201200, 2102102101
  return d.startsWith(block + block);
}

// Phrases no genuine "I need more work" enquiry contains.
const NEVER_A_REAL_LEAD = [
  'mailing list', 'newsletter', 'subscribe', 'subscription', 'weekly updates',
  'company news', 'add me for news', 'backlink', 'backlinks', 'link building',
  'guest post', 'domain authority', 'crypto', 'bitcoin', 'casino', 'viagra',
  'know your price', 'kindly reply', 'dear sir or madam',
  'capable partner', 'delighted to hear from you', 'partnership opportunity',
  'business proposal', 'we are looking for a', 'looking for a capable',
];

// Cold-pitch language. A real tradie might grumble about SEO, so these carry
// less weight and need company before they matter.
const COLD_PITCH = [
  'seo', 'search engine optimi', 'google ranking', 'google rankings',
  'first page of google', 'web design', 'website design', 'reviewed your website',
  'we help businesses', 'traffic dropped', 'business profile', 'company profile',
  'business listing', 'active listing', 'active inquiry', 'live chat',
  'increase your sales', 'improve your ranking', 'built a tool', 'i assist local',
];

const BURNER_EMAIL_DOMAINS = [
  'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru', 'yandex.ru',
  'rambler.ru', 'gmx.us', 'mailinator.com', 'guerrillamail.com',
  '10minutemail.com', 'tempmail.com', 'trashmail.com', 'sharklasers.com',
  'yopmail.com', 'dispostable.com', 'getnada.com', 'temp-mail.org',
];

// Cyrillic, Greek, Armenian, Hebrew, Arabic, Devanagari, Bengali, Thai,
// Georgian, CJK, Kana, Hangul.
const NON_LATIN =
  /[Ͱ-ϿЀ-ӿ԰-֏֐-׿؀-ۿऀ-ॿঀ-৿฀-๿Ⴀ-ჿ぀-ヿ一-鿿가-힯]/;

const phraseHit = (text, phrase) =>
  new RegExp(
    '\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
    'i'
  ).test(text);

function scoreSubmission(data, request) {
  const reasons = [];
  let score = 0;
  const add = (points, why) => {
    score += points;
    reasons.push(why);
  };

  const name = String(data.name || '').trim();
  const biz = String(data.biz || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const message = String(data.message || '').trim();
  const blob = [name, biz, message].join(' \n ');

  // ---- Phone ----
  if (!isAustralianPhone(phone)) {
    // Starts with 0 and roughly the right length: someone reaching for an
    // Australian number and missing. Treat a typo far more gently than a
    // number that was never Australian to begin with.
    const digits = phone.replace(/\D/g, '');
    const mistyped = /^0\d{8,10}$/.test(digits) && !/^(\d)\1+$/.test(digits);
    if (mistyped) add(1, 'phone looks like a mistyped Australian number');
    else add(4, 'phone is not a dialable Australian number');
  }
  if (isFillerPhone(phone)) add(3, 'phone matches a known filler pattern');

  // ---- Identity ----
  if (name && biz && name.toLowerCase() === biz.toLowerCase()) {
    add(2, 'name and business name are identical');
  }
  if (name && !/\s/.test(name) && name.length >= 8) {
    add(2, 'name is one run-on token');
  }

  // ---- Language ----
  if (NON_LATIN.test(blob)) add(3, 'non-Latin script');
  if (blob.split(/\s+/).some((w) => /[bcdfghjklmnpqrstvwxz]{6,}/i.test(w))) {
    add(4, 'keyboard-mash gibberish');
  }

  // ---- Message content ----
  const certain = NEVER_A_REAL_LEAD.filter((p) => phraseHit(blob, p)).length;
  const pitchy = COLD_PITCH.filter((p) => phraseHit(blob, p)).length;
  if (certain) add(Math.min(4, 2 + certain), certain + ' phrase(s) no real enquiry uses');
  if (pitchy) add(Math.min(3, pitchy + 1), pitchy + ' cold-pitch phrase(s)');

  // A genuine lead never types the agency's own domain back at it.
  if (/marcusresults\.com/i.test(message)) add(3, 'quotes our own domain back at us');
  if (/https?:\/\/|www\./i.test(message)) add(2, 'message contains a link');

  // ---- Email ----
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (BURNER_EMAIL_DOMAINS.includes(domain)) add(3, 'burner/bulk-spam email domain');

  // ---- Did this actually come from the form? ----
  const startedAt = Number(data.ts);
  if (!startedAt) {
    add(1, 'no page-load timestamp');
  } else {
    const seconds = (Date.now() - startedAt) / 1000;
    if (seconds >= 0 && seconds < 3) add(3, 'form filled in ' + seconds.toFixed(1) + 's');
  }
  if (!request.headers.get('origin') && !request.headers.get('referer')) {
    add(2, 'no Origin or Referer header');
  }

  return { score, reasons, verdict: score >= BLOCK_AT ? 'block' : score >= FLAG_AT ? 'flag' : 'pass' };
}

// Anything posting from somewhere other than our own site is not a customer.
function isForeignOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false; // absent is scored above, not blocked
  return !/^https?:\/\/(([a-z0-9-]+\.)*marcusresults\.com(\.au)?|([a-z0-9-]+\.)*pages\.dev|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/i.test(
    origin
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // ---- CORS / response helpers ----
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });

  try {
    const form = await request.formData();
    const data = Object.fromEntries(form.entries());

    // ---- Honeypots ----
    // Two fields no human can see or reach. Pretend success so bots don't retry.
    if (
      (data.website && data.website.length > 0) ||
      (data.company_url && data.company_url.length > 0)
    ) {
      return json({ ok: true });
    }

    // ---- Posted from somewhere that isn't our site ----
    if (isForeignOrigin(request)) {
      console.log('spam: foreign origin', request.headers.get('origin'));
      return json({ ok: true });
    }

    // ---- Turnstile verification ----
    const token = data['cf-turnstile-response'];
    if (env.TURNSTILE_SECRET_KEY) {
      if (!token) return json({ ok: false, error: 'Missing captcha.' }, 400);
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET_KEY,
            response: token,
            remoteip: ip,
          }),
        }
      );
      const verify = await verifyRes.json();
      if (!verify.success) {
        return json({ ok: false, error: 'Captcha failed.' }, 400);
      }
    }

    // ---- Basic validation ----
    const required = ['name', 'biz', 'phone', 'email'];
    for (const k of required) {
      if (!data[k] || String(data[k]).trim().length === 0) {
        return json({ ok: false, error: `Missing field: ${k}` }, 400);
      }
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      return json({ ok: false, error: 'Invalid email.' }, 400);
    }

    const submittedAt = new Date().toISOString();
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const referrer = request.headers.get('referer') || '';

    // ---- Spam scoring ----
    const spam = scoreSubmission(data, request);
    if (spam.verdict !== 'pass') {
      console.log(
        `spam ${spam.verdict} (${spam.score}) ${data.email} — ${spam.reasons.join('; ')}`
      );
    }

    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));

    // ---- Lead notification email via Resend ----
    if (!env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured');
      return json({ ok: false, error: 'Server misconfigured.' }, 500);
    }

    const toEmail = env.LEAD_TO_EMAIL || 'marcus@marcusresults.com.au';
    // Sending domain, not a contact address: only notify.marcusresults.com is
    // verified in Resend today. Verify notify.marcusresults.com.au there, then
    // set LEAD_FROM_EMAIL to move it — no code change or redeploy needed.
    const fromEmail =
      env.LEAD_FROM_EMAIL || 'Marcus Results <new-lead@notify.marcusresults.com>';

    // Blocked junk goes nowhere unless SPAM_ARCHIVE_EMAIL is set, in which case
    // it lands there so there is always a paper trail to check.
    const blocked = spam.verdict === 'block';
    if (blocked && !env.SPAM_ARCHIVE_EMAIL) {
      return json({ ok: true });
    }

    const prefix = blocked ? '[SPAM] ' : spam.verdict === 'flag' ? '[LIKELY SPAM] ' : '';
    const spamRow = spam.verdict === 'pass'
      ? ''
      : `<tr><td valign="top"><b>Spam score</b></td><td>${spam.score} — ${esc(spam.reasons.join('; '))}</td></tr>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [blocked ? env.SPAM_ARCHIVE_EMAIL : toEmail],
        reply_to: data.email,
        subject: `${prefix}New lead: ${data.name} — ${data.biz}`,
        html: `
          <h2>New game plan request</h2>
          <table cellpadding="6" style="font-family:sans-serif;font-size:14px;">
            <tr><td><b>Name</b></td><td>${esc(data.name)}</td></tr>
            <tr><td><b>Business</b></td><td>${esc(data.biz)}</td></tr>
            <tr><td><b>Phone</b></td><td><a href="tel:${esc(data.phone)}">${esc(data.phone)}</a></td></tr>
            <tr><td><b>Email</b></td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
            <tr><td valign="top"><b>Struggling with</b></td><td>${data.message && String(data.message).trim() ? esc(data.message).replace(/\n/g, '<br>') : '<span style="color:#999;">(not provided)</span>'}</td></tr>
            <tr><td><b>Submitted</b></td><td>${submittedAt}</td></tr>
            <tr><td><b>Referrer</b></td><td>${esc(referrer)}</td></tr>
            <tr><td><b>IP</b></td><td>${esc(ip)}</td></tr>
            ${spamRow}
          </table>
          <p style="font-family:sans-serif;font-size:13px;color:#666;">Reply to this email to reach the lead directly. Video due within 24hrs.</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      const text = await emailRes.text();
      console.error('Resend failed', emailRes.status, text);
      return json({ ok: false, error: 'Upstream error.' }, 502);
    }

    // ---- Optional: forward to GHL CRM (best effort, never blocks the lead) ----
    // Only clean leads reach the CRM — flagged ones stay in email for a human look.
    if (env.GHL_WEBHOOK_URL && spam.verdict === 'pass') {
      const [firstName, ...rest] = String(data.name).trim().split(' ');
      try {
        await fetch(env.GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            first_name: firstName,
            last_name: rest.join(' '),
            full_name: data.name,
            business_name: data.biz,
            phone: data.phone,
            email: data.email,
            message: data.message || '',
            source: 'marcusresults.com.au — Contact Form',
            submitted_at: submittedAt,
            ip,
            user_agent: request.headers.get('user-agent') || '',
            referrer,
          }),
        });
      } catch (err) {
        console.error('GHL webhook failed', err);
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}

// Reject everything that isn't POST
export const onRequest = async (context) => {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Method not allowed', { status: 405 });
};
