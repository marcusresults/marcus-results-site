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

    // ---- Honeypot ----
    if (data.website && data.website.length > 0) {
      // Pretend success so bots don't retry
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

    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));

    // ---- Lead notification email via Resend ----
    if (!env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured');
      return json({ ok: false, error: 'Server misconfigured.' }, 500);
    }

    const toEmail = env.LEAD_TO_EMAIL || 'marcus@marcusresults.com';
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'New Lead <new-lead@notify.marcusresults.com>',
        to: [toEmail],
        reply_to: data.email,
        subject: `New lead: ${data.name} — ${data.biz}`,
        html: `
          <h2>New game plan request</h2>
          <table cellpadding="6" style="font-family:sans-serif;font-size:14px;">
            <tr><td><b>Name</b></td><td>${esc(data.name)}</td></tr>
            <tr><td><b>Business</b></td><td>${esc(data.biz)}</td></tr>
            <tr><td><b>Phone</b></td><td><a href="tel:${esc(data.phone)}">${esc(data.phone)}</a></td></tr>
            <tr><td><b>Email</b></td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
            <tr><td><b>Submitted</b></td><td>${submittedAt}</td></tr>
            <tr><td><b>Referrer</b></td><td>${esc(referrer)}</td></tr>
            <tr><td><b>IP</b></td><td>${esc(ip)}</td></tr>
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
    if (env.GHL_WEBHOOK_URL) {
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
            source: 'marcusresults.com — Contact Form',
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
