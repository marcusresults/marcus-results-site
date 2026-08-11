# Marcus Results — Website

Built with [Eleventy](https://www.11ty.dev/), deployed to **Cloudflare Pages**.

## Stack
- **Framework:** Eleventy (static site generator — shared nav/footer, no duplication)
- **Hosting:** Cloudflare Pages (auto-deploy from GitHub on every push)
- **Contact form:** Cloudflare Pages Function → GoHighLevel inbound webhook
- **Spam protection:** Cloudflare Turnstile

## Local dev

```bash
npm install
npm run dev
# → http://localhost:3000
```

## How pages work

Every page in `src/` uses the shared layout in `src/_includes/base.njk`.
That layout contains the nav, footer, and sticky CTA — edit once, updates everywhere.

Page front matter controls the title, description, and which nav item is highlighted:
```yaml
---
layout: base.njk
title: Services — Marcus Results
description: Your page description here.
---
```

To add a new page, create `src/your-page.html` with that front matter and add a nav link to `src/_includes/base.njk`.

## First-time deploy

### 1. Push to GitHub
```bash
cd /Users/locke/marcus-results-site
git init
git add .
git commit -m "init"
git remote add origin git@github.com:marcus-results/website.git
git push -u origin main
```

### 2. Connect Cloudflare Pages
1. Cloudflare dash → **Workers & Pages → Create → Pages → Connect to Git**
2. Pick the `marcus-results/website` repo
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `_site`
4. **Save and Deploy**

Cloudflare gives you a free `*.pages.dev` URL immediately — your live domain is untouched until you add it as a custom domain.

### 3. Set environment variables
Pages project → **Settings → Environment variables → Production**:

| Variable | Value |
|---|---|
| `GHL_WEBHOOK_URL` | Your GHL inbound webhook URL |
| `TURNSTILE_SECRET_KEY` | Secret key from Cloudflare Turnstile |

Then **Retry deployment** so the function picks them up.

### 4. Set up Turnstile (spam protection on contact form)
1. Cloudflare dash → **Turnstile → Add site**
2. Add your `*.pages.dev` domain (and `marcusresults.com.au` when ready)
3. Copy the **Site key** → paste into `turnstileSiteKey` in `src/_data/site.json`

   While that value is empty the widget is not rendered at all and the form still
   works. It must hold a real key — a placeholder makes Turnstile paint a red
   "Error!" box on the form (console error 400020).
4. Copy the **Secret key** → add as `TURNSTILE_SECRET_KEY` env var (step 3)

### 5. Add your domain (when ready to go live)
Pages project → **Custom domains → Set up a custom domain** → `marcusresults.com.au`

If the domain is already on Cloudflare DNS it auto-creates the CNAME. Done.

## Ongoing updates

```bash
# Make changes to files in src/
git add .
git commit -m "your message"
git push
# Cloudflare auto-deploys in ~30 seconds
```

## Favicons
Drop your favicon files into `src/` and uncomment the favicon links in `src/_includes/base.njk`.
You have the source files at: `~/Downloads/Marcus results Favicons 512x512.png`

## GHL webhook field map

```json
{
  "first_name": "Dave",
  "last_name": "Smith",
  "full_name": "Dave Smith",
  "business_name": "Smith's Lawns",
  "phone": "0400000000",
  "email": "dave@smithslawns.com.au",
  "industry": "landscaping",
  "monthly_budget": "2-5k",
  "source": "marcusresults.com.au — Contact Form"
}
```
