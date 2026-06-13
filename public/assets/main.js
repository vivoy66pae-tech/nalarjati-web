// Nav scroll
const nav = document.getElementById('nav');
if (nav) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 16);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// Fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

// Stack grid (landing page)
const stackEl = document.getElementById('stack-grid');
if (stackEl) {
  const stack = ['TypeScript', 'Next.js', 'React', 'Node.js', 'Python', 'Go', 'Postgres', 'Redis', 'Docker', 'Kubernetes', 'Nginx', 'Terraform', 'OpenAI / Anthropic', 'LangChain / LlamaIndex', 'Vector DBs', 'GitHub Actions', 'Prometheus', 'Grafana'];
  stackEl.innerHTML = stack.map((s) => `<span class="stack-chip"><span class="dot"></span>${s}</span>`).join('');
}

// Generic AJAX form
async function postJSON(url, data) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

// Contact form
const cf = document.getElementById('contact-form');
if (cf) {
  const status = document.getElementById('contact-status');
  const submit = document.getElementById('contact-submit');
  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(cf);
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject'),
      message: fd.get('message'),
      hp: fd.get('hp'),
    };
    submit.disabled = true;
    submit.querySelector('.btn-label').textContent = 'Sending…';
    status.textContent = '';
    status.className = 'form-status';
    try {
      const { ok, body } = await postJSON('/api/contact', payload);
      if (ok) {
        status.textContent = 'Thanks — message sent. I\'ll reply within 24h.';
        status.classList.add('success');
        cf.reset();
      } else {
        status.textContent = body.error || 'Something went wrong.';
        status.classList.add('error');
      }
    } catch (err) {
      status.textContent = 'Network error — try again?';
      status.classList.add('error');
    } finally {
      submit.disabled = false;
      submit.querySelector('.btn-label').textContent = 'Send message';
    }
  });
}

// Newsletter form
const nf = document.getElementById('newsletter-form');
if (nf) {
  const status = document.getElementById('newsletter-status');
  nf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(nf);
    const btn = nf.querySelector('button');
    btn.disabled = true;
    status.textContent = '';
    status.className = 'form-status';
    try {
      const { ok, body } = await postJSON('/api/subscribe', {
        email: fd.get('email'),
        name: fd.get('name'),
        hp: fd.get('hp'),
      });
      if (ok) {
        status.textContent = body.already ? 'You\'re already on the list ✓' : 'Subscribed ✓ Check your inbox.';
        status.classList.add('success');
        if (!body.already) nf.reset();
      } else {
        status.textContent = body.error || 'Could not subscribe.';
        status.classList.add('error');
      }
    } catch (err) {
      status.textContent = 'Network error — try again?';
      status.classList.add('error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Privacy-friendly analytics — fire-and-forget
if (navigator.sendBeacon) {
  const data = JSON.stringify({ path: location.pathname + location.hash, ref: document.referrer });
  navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
} else {
  fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: location.pathname, ref: document.referrer }), keepalive: true }).catch(() => {});
}
