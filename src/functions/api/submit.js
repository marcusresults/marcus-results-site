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

    // ---- Build GHL payload ----
    // GHL inbound webhooks accept arbitrary JSON; map to their expected fields.
    const [firstName, ...rest] = String(data.name).trim().split(' ');
    const lastName = rest.join(' ');

    const payload = {
      first_name: firstName,
      last_name: lastName || '',
      full_name: data.name,
      business_name: data.biz,
      phone: data.phone,
      email: data.email,
      industry: data.industry || '',
      monthly_budget: data.budget || '',
      source: 'marcusresults.com.au — Contact Form',
      submitted_at: new Date().toISOString(),
      ip: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('user-agent') || '',
      referrer: request.headers.get('referer') || '',
    };

    // ---- Forward to GHL ----
    if (!env.GHL_WEBHOOK_URL) {
      console.warn('GHL_WEBHOOK_URL not configured');
      return json({ ok: false, error: 'Server misconfigured.' }, 500);
    }

    const ghlRes = await fetch(env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!ghlRes.ok) {
      const text = await ghlRes.text();
      console.error('GHL webhook failed', ghlRes.status, text);
      return json({ ok: false, error: 'Upstream error.' }, 502);
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
