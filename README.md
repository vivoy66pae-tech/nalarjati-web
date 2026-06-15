# nalarjati.dev — Setup & Operations

Full-stack landing page + blog + portfolio + lead capture. Self-hosted on a single VPS.

## Architecture

```
Internet
   ↓
Nginx (443/80)  ← SSL termination, static, rate limit, basic auth for /admin
   ↓
Node.js app (127.0.0.1:3030)  ← systemd service
   ├── Express routes (API, blog, portfolio, OG, admin, sitemap, RSS)
   ├── SQLite (data/nalarjati.db)
   ├── Markdown content (content/blog/*.md, content/portfolio.json)
   └── Nodemailer (SMTP, optional, graceful fallback)
```

## File layout

```
/opt/nalarjati/
├── server.js                # Node entry point
├── package.json             # Dependencies
├── .env                     # Environment (admin creds, SMTP, etc) — DO NOT COMMIT
├── .env.example             # Template
├── src/
│   ├── config.js            # Env loading + paths
│   ├── db.js                # SQLite schema + IP hashing
│   ├── email.js             # Nodemailer wrapper (graceful no-op if SMTP unset)
│   ├── markdown.js          # Frontmatter parsing + marked render
│   ├── auth.js              # Basic auth middleware
│   └── routes/
│       ├── contact.js       # POST /api/contact
│       ├── subscribe.js     # POST /api/subscribe
│       ├── track.js         # POST /api/track (analytics)
│       ├── posts.js         # GET /api/posts, /api/posts/:slug
│       ├── portfolio.js     # GET /api/portfolio, /api/portfolio/:slug
│       ├── og.js            # GET /og?title=... (SVG generator)
│       ├── admin.js         # GET /api/admin/* (basic auth)
│       ├── sitemap.js       # GET /sitemap.xml, /robots.txt
│       └── rss.js           # GET /feed.xml
├── public/                  # Static files served by Node
│   ├── index.html           # Landing page
│   ├── 404.html
│   ├── blog/index.html      # Blog list + detail (SPA, client-side routing)
│   ├── portfolio/index.html # Portfolio list
│   ├── admin/index.html     # Admin dashboard
│   └── assets/{main.css,main.js}
├── content/                 # Editable content
│   ├── blog/*.md            # Blog posts (frontmatter: title, date, slug, excerpt, tags, draft)
│   └── portfolio.json       # Projects array
├── data/nalarjati.db        # SQLite (auto-created)
└── logs/{app.log,error.log} # App stdout/stderr

/etc/systemd/system/nalarjati.service   # systemd unit
/etc/nginx/sites-enabled/default         # Nginx site (HTTPS + reverse proxy)
/etc/nginx/.htpasswd                     # Admin basic auth
/var/log/nginx/error.log                 # Nginx logs (fail2ban watches this)
```

## Common operations

```bash
# Service control
sudo systemctl status nalarjati
sudo systemctl restart nalarjati
sudo systemctl stop nalarjati
journalctl -u nalarjati -f           # Live logs

# Tail app logs
tail -f /opt/nalarjati/logs/app.log
tail -f /opt/nalarjati/logs/error.log

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log

# Database
sqlite3 /opt/nalarjati/data/nalarjati.db
> .tables
> SELECT COUNT(*) FROM contact_submissions;
> SELECT COUNT(*) FROM subscribers;
> .quit

# Database backup
sudo cp /opt/nalarjati/data/nalarjati.db /opt/nalarjati/data/backup-$(date +%F).db
```

## Adding a blog post

1. Create `/opt/nalarjati/content/blog/your-slug.md`:
   ```markdown
   ---
   title: "Your title here"
   date: 2026-06-13
   slug: your-slug
   excerpt: "Short description for cards and RSS"
   tags: [tag1, tag2]
   author: "nalarjati.dev"
   draft: false
   ---

   # Heading 1
   Body content in **markdown**.
   ```
2. Save. No restart needed — file is read on every request.
3. Verify at `https://nalarjati.dev/blog/your-slug`

## Adding a portfolio project

Edit `/opt/nalarjati/content/portfolio.json`:
```json
[
  {
    "slug": "project-slug",
    "title": "Project title",
    "summary": "One-line description",
    "role": "What I did",
    "year": "2026",
    "stack": ["Tech", "Used"],
    "highlights": ["Achievement 1", "Achievement 2"],
    "link": null
  }
]
```

## Enabling real email (SMTP)

Right now submissions are saved to SQLite and logged but **not emailed**. To enable:

1. Sign up with an email provider (any of these work):
   - **Mailgun** — https://www.mailgun.com/ (5,000 free/month)
   - **Resend** — https://resend.com/ (3,000 free/month)
   - **SendGrid** — https://sendgrid.com/ (100/day free)
   - Any generic SMTP server (Gmail, Zoho, etc.)

2. Get SMTP credentials from the provider's dashboard.

3. Edit `/opt/nalarjati/.env`:
   ```
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@mg.yourdomain.com
   SMTP_PASS=your-smtp-password
   MAIL_FROM="nalarjati.dev <hello@yourdomain.com>"
   MAIL_TO=hello@yourdomain.com
   ```

4. Restart: `sudo systemctl restart nalarjati`

5. Test: submit the contact form. Check `/admin` for `emailed=1` status. Check your inbox for the email.

## Admin dashboard

URL: `https://nalarjati.dev/admin/`

Default credentials are loaded from `/opt/nalarjati/.env` (`ADMIN_USER`, `ADMIN_PASS`).
See `.env.example` for the expected format. Do **not** commit real values to this repo.

To change, edit `/opt/nalarjati/.env` (ADMIN_USER, ADMIN_PASS) and run:
```bash
NEW_PASS="your-new-password"
HASH=$(htpasswd -nb admin "$NEW_PASS")
echo "admin:${HASH#*:}" | sudo tee /etc/nginx/.htpasswd
sudo chmod 640 /etc/nginx/.htpasswd
sudo systemctl reload nginx
```

The admin dashboard shows:
- **Overview**: pageviews today, all-time, contacts, subscribers + bar chart of last 7 days + top paths/referrers
- **Contacts**: list of contact submissions (with email status)
- **Subscribers**: list of newsletter signups, with **Export CSV** button

## Security

- HTTPS via Let's Encrypt (auto-renew)
- HSTS preload (1 year, include subdomains)
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Rate limiting (10 req/s for API, 5 req/m for sensitive endpoints)
- Fail2ban watching nginx auth errors (5 fails in 10 min → 1h ban)
- Honeypot field on contact + subscribe (catches bots)
- Helmet-style headers in Node
- Basic auth on /admin (htpasswd)

To uninstall/remove the app:
```bash
sudo systemctl disable --now nalarjati
sudo rm -rf /opt/nalarjati /etc/systemd/system/nalarjati.service
sudo rm /etc/nginx/.htpasswd
# Edit /etc/nginx/sites-enabled/default to remove the proxy_pass /admin blocks
```

## Adding more domains

For another domain (e.g. `app.nalarjati.dev`):
```bash
# 1. Get cert
sudo certbot --nginx -d app.nalarjati.dev

# 2. Add a new server block to /etc/nginx/sites-enabled/default
#    (or use /etc/nginx/sites-enabled/app.nalarjati.dev)
#    Copy the existing nalarjati.dev block, change server_name + paths

# 3. Reload
sudo nginx -t && sudo systemctl reload nginx
```
