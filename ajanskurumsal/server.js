const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// ---------------- Utility helpers ----------------
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, defaultValue) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseCookies(req) {
  const header = req.headers['cookie'] || '';
  const cookies = Object.create(null);
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

function setCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`); else parts.push('Path=/');
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`); else parts.push('SameSite=Lax');
  if (options.secure != null ? options.secure : process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function parseFormUrlEncoded(body) {
  const obj = Object.create(null);
  body.split('&').forEach((pair) => {
    if (!pair) return;
    const [k, v] = pair.split('=');
    const key = decodeURIComponent(k.replace(/\+/g, ' '));
    const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
    if (obj[key] == null) obj[key] = val; else if (Array.isArray(obj[key])) obj[key].push(val); else obj[key] = [obj[key], val];
  });
  return obj;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function contentTypeByExt(ext) {
  switch (ext) {
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.json': return 'application/json; charset=utf-8';
    case '.ico': return 'image/x-icon';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

// ---------------- App data & setup ----------------
function defaultSite() {
  return {
    meta: {
      siteName: 'Vela Ajans',
      siteDescription: 'İşinizi hızla büyüten yaratıcı dijital ajans.',
      colors: {
        brand: '#7b61ff',
        accent: '#00ffcc',
        bg: '#0b1020',
        text: '#d8e2ff'
      }
    },
    hero: {
      headline: 'Markanızı hızlandıran tasarım ve teknoloji',
      subheadline: 'Dijital ürün, marka ve büyüme odaklı çözümler ile hedefe daha hızlı ulaşın.',
      ctaPrimary: 'Teklif Al',
      ctaSecondary: 'Portfolyoyu Gör'
    },
    about: {
      title: 'Biz kimiz?',
      text: 'Vela Ajans; strateji, tasarım ve yazılımı birleştirerek ölçülebilir sonuçlar üreten dijital bir ekip. Kurumsal web, ürün arayüzü ve performans odaklı dönüşüm projeleri geliştiriyoruz.'
    },
    services: [
      { title: 'Kurumsal Web', description: 'Hızlı, modern ve SEO uyumlu kurumsal web siteleri', icon: '🧭' },
      { title: 'UI/UX Tasarım', description: 'Kullanıcı odaklı arayüz ve deneyim tasarımı', icon: '🎨' },
      { title: 'Yazılım Geliştirme', description: 'Ölçeklenebilir ve güvenli web uygulamaları', icon: '🛠️' },
      { title: 'Marka & Kimlik', description: 'Logodan kılavuzlara uzanan bütüncül marka tasarımı', icon: '✨' }
    ],
    projects: [
      { title: 'NovaCRM', description: 'B2B satış ekipleri için modern CRM', tags: ['UI/UX', 'Web Uygulaması'] },
      { title: 'AetherPay', description: 'SaaS ödeme sayfası ve onboarding', tags: ['Arayüz', 'Ödeme'] },
      { title: 'LumiCare', description: 'Sağlık platformu kurumsal web', tags: ['Kurumsal', 'Sağlık'] }
    ],
    testimonials: [
      { name: 'Ece K.', role: 'Pazarlama Direktörü', quote: 'Dakik, yaratıcı ve ölçülebilir sonuçlar. Trafiğimiz 2 kat arttı.' },
      { name: 'Okan T.', role: 'Ürün Yöneticisi', quote: 'Arayüzlerimiz hem daha hızlı hem daha anlaşılır oldu.' }
    ],
    contact: {
      email: 'iletisim@velaajans.com',
      phone: '+90 212 000 00 00',
      address: 'İstanbul, Türkiye'
    }
  };
}

function ensureSetup() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);

  const sitePath = path.join(DATA_DIR, 'site.json');
  if (!fs.existsSync(sitePath)) {
    writeJson(sitePath, defaultSite());
  }
  const messagesPath = path.join(DATA_DIR, 'messages.json');
  if (!fs.existsSync(messagesPath)) {
    writeJson(messagesPath, []);
  }
  const secretPath = path.join(DATA_DIR, 'secret.txt');
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, crypto.randomBytes(48).toString('hex'), 'utf8');
  }
  const adminPath = path.join(DATA_DIR, 'admin.json');
  if (!fs.existsSync(adminPath)) {
    const username = 'admin';
    const password = generatePassword();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    writeJson(adminPath, { username, salt, hash });
    const firstRunNote = `Admin kullanıcı oluşturuldu\nKullanıcı adı: ${username}\nŞifre: ${password}\nLütfen ilk girişten sonra değiştirin.\n`;
    fs.writeFileSync(path.join(DATA_DIR, 'first-run.txt'), firstRunNote, 'utf8');
    console.log(firstRunNote.trim());
  }
}

function generatePassword() {
  return 'A' + crypto.randomBytes(6).toString('base64url');
}

function getSecret() {
  const secret = fs.readFileSync(path.join(DATA_DIR, 'secret.txt'), 'utf8').trim();
  return secret;
}

function hmacSign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

const inMemorySessions = new Map();

function createSession(username) {
  const sessionId = crypto.randomBytes(18).toString('hex');
  const sig = hmacSign(sessionId);
  inMemorySessions.set(sessionId, { username, createdAt: Date.now() });
  return `${sessionId}.${sig}`;
}

function parseSessionCookie(cookies) {
  const raw = cookies['session'];
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  if (hmacSign(id) !== sig) return null;
  const sess = inMemorySessions.get(id);
  if (!sess) return null;
  return { id, ...sess };
}

function makeCsrfToken(sessionId) {
  return hmacSign(`csrf:${sessionId}`);
}

function verifyCsrf(sessionId, token) {
  return makeCsrfToken(sessionId) === token;
}

function sendHtml(res, status, html, cookies = []) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookies });
  res.end(html);
}

function sendJson(res, status, obj, cookies = []) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookies });
  res.end(JSON.stringify(obj));
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, { Location: location, 'Set-Cookie': cookies });
  res.end();
}

function serveStatic(req, res, pathname) {
  const filePath = path.join(PUBLIC_DIR, pathname.replace(/^\/public\//, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404).end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypeByExt(ext);
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

// ---------------- Renderers ----------------
function getSite() {
  return readJson(path.join(DATA_DIR, 'site.json'), defaultSite());
}

function layoutHtml({ title, description, active, bodyHtml, site }) {
  const colors = site.meta.colors;
  const navItems = [
    { href: '/', label: 'Anasayfa' },
    { href: '/hizmetler', label: 'Hizmetler' },
    { href: '/portfolyo', label: 'Portfolyo' },
    { href: '/hakkimizda', label: 'Hakkımızda' },
    { href: '/iletisim', label: 'İletişim' }
  ];
  const navHtml = navItems.map((n) => `<a class="nav-link${active === n.href ? ' active' : ''}" href="${n.href}">${n.label}</a>`).join('');
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} • ${escapeHtml(site.meta.siteName)}</title>
  <meta name="description" content="${escapeHtml(description || site.meta.siteDescription)}" />
  <link rel="icon" href="/public/favicon.svg" />
  <link rel="stylesheet" href="/public/css/theme.css" />
  <style>
    :root{ --brand:${colors.brand}; --accent:${colors.accent}; --bg:${colors.bg}; --text:${colors.text}; }
  </style>
  <script defer src="/public/js/site.js"></script>
</head>
<body>
  <div class="theme-orb"></div>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/"><span class="logo-mark">V</span><span class="logo-text">${escapeHtml(site.meta.siteName)}</span></a>
      <nav class="nav">${navHtml}</nav>
      <a class="btn-ghost small" href="/admin/login">Admin</a>
    </div>
  </header>
  <main class="main container">${bodyHtml}</main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div>© ${new Date().getFullYear()} ${escapeHtml(site.meta.siteName)} — Tüm hakları saklıdır.</div>
      <div class="footer-links"><a href="/iletisim">İletişim</a><a href="/hakkimizda">Hakkımızda</a></div>
    </div>
  </footer>
</body>
</html>`;
}

function renderHome(site) {
  const hero = site.hero;
  const services = site.services.map((s) => `
    <div class="card service-card">
      <div class="icon">${escapeHtml(s.icon)}</div>
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.description)}</p>
    </div>
  `).join('');
  const projects = site.projects.map((p, idx) => `
    <a class="card project-card" href="#" aria-label="${escapeHtml(p.title)}">
      <div class="project-thumb" data-i="${idx}"></div>
      <div class="project-info">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    </a>
  `).join('');
  const body = `
    <section class="hero">
      <div class="hero-content">
        <h1><span class="highlight">${escapeHtml(hero.headline)}</span></h1>
        <p class="lead">${escapeHtml(hero.subheadline)}</p>
        <div class="actions">
          <a class="btn" href="/iletisim">${escapeHtml(hero.ctaPrimary)}</a>
          <a class="btn-ghost" href="/portfolyo">${escapeHtml(hero.ctaSecondary)}</a>
        </div>
      </div>
    </section>
    <section class="grid two">
      <div>
        <h2 class="section-title">Hizmetler</h2>
        <div class="grid three">${services}</div>
      </div>
      <div>
        <h2 class="section-title">Portfolyo</h2>
        <div class="grid three">${projects}</div>
      </div>
    </section>
    <section class="about">
      <div class="about-card card">
        <h2>${escapeHtml(site.about.title)}</h2>
        <p>${escapeHtml(site.about.text)}</p>
      </div>
    </section>
    <section class="cta">
      <div class="cta-card card">
        <h2>Projenizi birlikte hızlandıralım</h2>
        <p>Hedeflerinizi duymak için sabırsızlanıyoruz.</p>
        <a class="btn" href="/iletisim">Bize Ulaşın</a>
      </div>
    </section>
  `;
  return layoutHtml({ title: 'Anasayfa', description: site.meta.siteDescription, active: '/', bodyHtml: body, site });
}

function renderServices(site) {
  const services = site.services.map((s) => `
    <div class="card service-card">
      <div class="icon">${escapeHtml(s.icon)}</div>
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.description)}</p>
    </div>
  `).join('');
  const body = `
    <h1 class="page-title">Hizmetler</h1>
    <div class="grid three">${services}</div>
  `;
  return layoutHtml({ title: 'Hizmetler', description: 'Sunduğumuz hizmetler', active: '/hizmetler', bodyHtml: body, site });
}

function renderPortfolio(site) {
  const projects = site.projects.map((p, idx) => `
    <div class="card project-card">
      <div class="project-thumb" data-i="${idx}"></div>
      <div class="project-info">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');
  const body = `
    <h1 class="page-title">Portfolyo</h1>
    <div class="grid three">${projects}</div>
  `;
  return layoutHtml({ title: 'Portfolyo', description: 'Seçili işlerimiz', active: '/portfolyo', bodyHtml: body, site });
}

function renderAbout(site) {
  const testimonials = site.testimonials.map((t) => `
    <div class="card testimonial">
      <p class="quote">“${escapeHtml(t.quote)}”</p>
      <div class="person">${escapeHtml(t.name)} • ${escapeHtml(t.role)}</div>
    </div>
  `).join('');
  const body = `
    <h1 class="page-title">Hakkımızda</h1>
    <div class="grid two">
      <div class="card">
        <h2>${escapeHtml(site.about.title)}</h2>
        <p>${escapeHtml(site.about.text)}</p>
      </div>
      <div class="grid two">${testimonials}</div>
    </div>
  `;
  return layoutHtml({ title: 'Hakkımızda', description: 'Ekibimiz ve yaklaşımımız', active: '/hakkimizda', bodyHtml: body, site });
}

function renderContact(site, params = {}) {
  const success = params.success;
  const body = `
    <h1 class="page-title">İletişim</h1>
    ${success ? '<div class="alert success">Mesajınız alındı. En kısa sürede dönüş yapacağız.</div>' : ''}
    <div class="grid two">
      <form class="card form" method="post" action="/iletisim">
        <div class="form-row"><label>Ad Soyad</label><input name="name" required /></div>
        <div class="form-row"><label>E-posta</label><input type="email" name="email" required /></div>
        <div class="form-row"><label>Konu</label><input name="subject" required /></div>
        <div class="form-row"><label>Mesaj</label><textarea name="message" rows="6" required></textarea></div>
        <button class="btn" type="submit">Gönder</button>
      </form>
      <div class="card">
        <h2>Bize Ulaşın</h2>
        <p><strong>E-posta:</strong> ${escapeHtml(site.contact.email)}</p>
        <p><strong>Telefon:</strong> ${escapeHtml(site.contact.phone)}</p>
        <p><strong>Adres:</strong> ${escapeHtml(site.contact.address)}</p>
      </div>
    </div>
  `;
  return layoutHtml({ title: 'İletişim', description: 'Bizimle iletişime geçin', active: '/iletisim', bodyHtml: body, site });
}

// ---------------- Admin renderers ----------------
function renderAdminLayout({ title, bodyHtml, session }) {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin • ${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/css/theme.css" />
  <style>:root{ --bg:#0c0f1e; }</style>
  <script defer src="/public/js/admin.js"></script>
</head>
<body>
  <div class="theme-orb"></div>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/admin"><span class="logo-mark">A</span><span class="logo-text">Yönetim</span></a>
      <nav class="nav">
        <a class="nav-link" href="/admin">Genel</a>
        <a class="nav-link" href="/admin/icerik">İçerik</a>
        <a class="nav-link" href="/admin/ayarlar">Ayarlar</a>
        <a class="nav-link" href="/admin/mesajlar">Mesajlar</a>
      </nav>
      <a class="btn-ghost small" href="/admin/logout">Çıkış</a>
    </div>
  </header>
  <main class="main container">${bodyHtml}</main>
</body></n></html>`;
}

function renderLogin(csrfToken, error) {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin Giriş</title>
  <link rel="stylesheet" href="/public/css/theme.css" />
</head>
<body>
  <div class="theme-orb"></div>
  <main class="main container" style="max-width:560px">
    <div class="card">
      <h1>Yönetim Paneli</h1>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/admin/login">
        <input type="hidden" name="csrf" value="${csrfToken}" />
        <div class="form-row"><label>Kullanıcı adı</label><input name="username" required /></div>
        <div class="form-row"><label>Şifre</label><input type="password" name="password" required /></div>
        <button class="btn" type="submit">Giriş yap</button>
      </form>
    </div>
  </main>
</body>
</html>`;
}

function renderAdminDashboard(site, stats) {
  const body = `
    <h1 class="page-title">Genel Bakış</h1>
    <div class="grid three">
      <div class="card"><h3>Hizmet</h3><div class="kpi">${stats.services}</div></div>
      <div class="card"><h3>Proje</h3><div class="kpi">${stats.projects}</div></div>
      <div class="card"><h3>Mesaj</h3><div class="kpi">${stats.messages}</div></div>
    </div>
  `;
  return renderAdminLayout({ title: 'Genel', bodyHtml: body });
}

function renderAdminContent(site, csrfToken, flash) {
  const body = `
    <h1 class="page-title">İçerik</h1>
    ${flash ? `<div class="alert success">${escapeHtml(flash)}</div>` : ''}
    <div class="grid two">
      <form class="card form" method="post" action="/admin/icerik">
        <input type="hidden" name="csrf" value="${csrfToken}" />
        <h2>Hero</h2>
        <div class="form-row"><label>Başlık</label><input name="heroHeadline" value="${escapeHtml(site.hero.headline)}" /></div>
        <div class="form-row"><label>Alt başlık</label><input name="heroSubheadline" value="${escapeHtml(site.hero.subheadline)}" /></div>
        <h2>Hakkımızda</h2>
        <div class="form-row"><label>Başlık</label><input name="aboutTitle" value="${escapeHtml(site.about.title)}" /></div>
        <div class="form-row"><label>Metin</label><textarea name="aboutText" rows="6">${escapeHtml(site.about.text)}</textarea></div>
        <h2>Hizmetler (JSON)</h2>
        <div class="form-row"><textarea name="servicesJson" rows="8">${escapeHtml(JSON.stringify(site.services, null, 2))}</textarea></div>
        <h2>Projeler (JSON)</h2>
        <div class="form-row"><textarea name="projectsJson" rows="8">${escapeHtml(JSON.stringify(site.projects, null, 2))}</textarea></div>
        <button class="btn" type="submit">Kaydet</button>
        <button class="btn-ghost" type="button" onclick="window.prettyJson(this.form)">JSON Biçimlendir</button>
      </form>
      <div class="card">
        <h2>İpucu</h2>
        <p>Hizmetler ve projeler için JSON dizisi beklenir. Örnek eleman:</p>
        <pre><code>{ "title": "Yeni Hizmet", "description": "Açıklama", "icon": "🚀" }</code></pre>
        <pre><code>{ "title": "Proje", "description": "Kısa açıklama", "tags": ["UI/UX", "Web"] }</code></pre>
      </div>
    </div>
  `;
  return renderAdminLayout({ title: 'İçerik', bodyHtml: body });
}

function renderAdminSettings(site, csrfToken, flash) {
  const c = site.meta.colors;
  const body = `
    <h1 class="page-title">Ayarlar</h1>
    ${flash ? `<div class="alert success">${escapeHtml(flash)}</div>` : ''}
    <div class="grid two">
      <form class="card form" method="post" action="/admin/ayarlar">
        <input type="hidden" name="csrf" value="${csrfToken}" />
        <h2>Site Bilgileri</h2>
        <div class="form-row"><label>Site adı</label><input name="siteName" value="${escapeHtml(site.meta.siteName)}" /></div>
        <div class="form-row"><label>Açıklama</label><input name="siteDescription" value="${escapeHtml(site.meta.siteDescription)}" /></div>
        <h2>Renkler</h2>
        <div class="form-row"><label>Marka</label><input name="brand" value="${escapeHtml(c.brand)}" /></div>
        <div class="form-row"><label>Vurgu</label><input name="accent" value="${escapeHtml(c.accent)}" /></div>
        <div class="form-row"><label>Arkaplan</label><input name="bg" value="${escapeHtml(c.bg)}" /></div>
        <div class="form-row"><label>Metin</label><input name="text" value="${escapeHtml(c.text)}" /></div>
        <button class="btn" type="submit">Kaydet</button>
      </form>
      <form class="card form" method="post" action="/admin/sifre">
        <input type="hidden" name="csrf" value="${csrfToken}" />
        <h2>Şifre Değiştirme</h2>
        <div class="form-row"><label>Mevcut Şifre</label><input type="password" name="current" required /></div>
        <div class="form-row"><label>Yeni Şifre</label><input type="password" name="next" required /></div>
        <button class="btn" type="submit">Şifreyi Güncelle</button>
      </form>
    </div>
  `;
  return renderAdminLayout({ title: 'Ayarlar', bodyHtml: body });
}

function renderAdminMessages(messages) {
  const rows = messages.map((m) => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.email)}</td>
      <td>${escapeHtml(m.subject)}</td>
      <td>${escapeHtml(new Date(m.createdAt).toLocaleString('tr-TR'))}</td>
      <td><input type="checkbox" name="id" value="${escapeHtml(m.id)}" /></td>
    </tr>
  `).join('');
  const body = `
    <h1 class="page-title">Mesajlar</h1>
    <form class="card" method="post" action="/admin/mesajlar/sil">
      <table class="table">
        <thead><tr><th>Ad</th><th>E-posta</th><th>Konu</th><th>Tarih</th><th>Sil</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="actions"><button class="btn" type="submit">Seçilenleri Sil</button></div>
    </form>
  `;
  return renderAdminLayout({ title: 'Mesajlar', bodyHtml: body });
}

// ---------------- Router ----------------
async function router(req, res) {
  try {
    const { pathname, query } = url.parse(req.url, true);
    const method = req.method || 'GET';
    const cookies = parseCookies(req);
    const site = getSite();

    // static
    if (pathname.startsWith('/public/')) {
      return serveStatic(req, res, pathname);
    }
    if (pathname === '/favicon.ico') {
      req.url = '/public/favicon.svg';
      return serveStatic(req, res, '/public/favicon.svg');
    }

    // public pages
    if (method === 'GET' && pathname === '/') return sendHtml(res, 200, renderHome(site));
    if (method === 'GET' && pathname === '/hizmetler') return sendHtml(res, 200, renderServices(site));
    if (method === 'GET' && pathname === '/portfolyo') return sendHtml(res, 200, renderPortfolio(site));
    if (method === 'GET' && pathname === '/hakkimizda') return sendHtml(res, 200, renderAbout(site));
    if (method === 'GET' && pathname === '/iletisim') return sendHtml(res, 200, renderContact(site));

    if (method === 'POST' && pathname === '/iletisim') {
      const body = await readBody(req);
      const form = parseFormUrlEncoded(body);
      const messages = readJson(path.join(DATA_DIR, 'messages.json'), []);
      const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        name: (form.name || '').slice(0, 120),
        email: (form.email || '').slice(0, 200),
        subject: (form.subject || '').slice(0, 200),
        message: (form.message || '').slice(0, 5000),
        createdAt: Date.now()
      };
      messages.push(msg);
      writeJson(path.join(DATA_DIR, 'messages.json'), messages);
      return sendHtml(res, 200, renderContact(site, { success: true }));
    }

    // admin auth
    const session = parseSessionCookie(cookies);

    if (method === 'GET' && pathname === '/admin/login') {
      // ephemeral csrf for login based on a temp session id
      const loginSid = crypto.randomBytes(12).toString('hex');
      const csrf = hmacSign('login:' + loginSid);
      const cookie = setCookie('login_sid', loginSid, { httpOnly: true });
      return sendHtml(res, 200, renderLogin(csrf), [cookie]);
    }

    if (method === 'POST' && pathname === '/admin/login') {
      const body = await readBody(req);
      const form = parseFormUrlEncoded(body);
      const loginSid = cookies['login_sid'];
      if (!loginSid || hmacSign('login:' + loginSid) !== (form.csrf || '')) {
        return sendHtml(res, 400, renderLogin('', 'Geçersiz CSRF.')); 
      }
      const admin = readJson(path.join(DATA_DIR, 'admin.json'), null);
      if (!admin) return sendHtml(res, 500, 'Admin yapılandırması eksik');
      const { username, salt, hash } = admin;
      const okUser = (form.username || '') === username;
      let okPass = false;
      try {
        const h = crypto.scryptSync(form.password || '', salt, 64).toString('hex');
        okPass = crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
      } catch (e) { okPass = false; }
      if (!okUser || !okPass) {
        return sendHtml(res, 401, renderLogin(hmacSign('login:' + loginSid), 'Kullanıcı adı veya şifre hatalı.'));
      }
      const sessCookieVal = createSession(username);
      const cookiesOut = [
        setCookie('session', sessCookieVal, {}),
        setCookie('login_sid', '', { maxAge: 0 })
      ];
      return redirect(res, '/admin', cookiesOut);
    }

    if (pathname.startsWith('/admin')) {
      if (!session) return redirect(res, '/admin/login');
      const csrfToken = makeCsrfToken(session.id);
      if (method === 'GET' && pathname === '/admin') {
        const stats = {
          services: site.services.length,
          projects: site.projects.length,
          messages: readJson(path.join(DATA_DIR, 'messages.json'), []).length
        };
        return sendHtml(res, 200, renderAdminDashboard(site, stats));
      }
      if (method === 'GET' && pathname === '/admin/icerik') {
        return sendHtml(res, 200, renderAdminContent(site, csrfToken, query.flash));
      }
      if (method === 'POST' && pathname === '/admin/icerik') {
        const body = await readBody(req);
        const form = parseFormUrlEncoded(body);
        if (!verifyCsrf(session.id, form.csrf || '')) return sendHtml(res, 400, 'CSRF doğrulanamadı');
        try {
          const newSite = JSON.parse(JSON.stringify(site));
          newSite.hero.headline = String(form.heroHeadline || '').slice(0, 200);
          newSite.hero.subheadline = String(form.heroSubheadline || '').slice(0, 400);
          newSite.about.title = String(form.aboutTitle || '').slice(0, 200);
          newSite.about.text = String(form.aboutText || '').slice(0, 2000);
          if (form.servicesJson) newSite.services = JSON.parse(form.servicesJson);
          if (form.projectsJson) newSite.projects = JSON.parse(form.projectsJson);
          writeJson(path.join(DATA_DIR, 'site.json'), newSite);
          return redirect(res, '/admin/icerik?flash=Kaydedildi');
        } catch (e) {
          return sendHtml(res, 400, renderAdminContent(site, csrfToken, 'Hata: ' + e.message));
        }
      }
      if (method === 'GET' && pathname === '/admin/ayarlar') {
        return sendHtml(res, 200, renderAdminSettings(site, csrfToken, query.flash));
      }
      if (method === 'POST' && pathname === '/admin/ayarlar') {
        const body = await readBody(req);
        const form = parseFormUrlEncoded(body);
        if (!verifyCsrf(session.id, form.csrf || '')) return sendHtml(res, 400, 'CSRF doğrulanamadı');
        const newSite = JSON.parse(JSON.stringify(site));
        newSite.meta.siteName = String(form.siteName || newSite.meta.siteName).slice(0, 200);
        newSite.meta.siteDescription = String(form.siteDescription || newSite.meta.siteDescription).slice(0, 300);
        const c = newSite.meta.colors;
        c.brand = String(form.brand || c.brand).slice(0, 20);
        c.accent = String(form.accent || c.accent).slice(0, 20);
        c.bg = String(form.bg || c.bg).slice(0, 20);
        c.text = String(form.text || c.text).slice(0, 20);
        writeJson(path.join(DATA_DIR, 'site.json'), newSite);
        return redirect(res, '/admin/ayarlar?flash=Ayarlar+g%C3%BCncellendi');
      }
      if (method === 'POST' && pathname === '/admin/sifre') {
        const body = await readBody(req);
        const form = parseFormUrlEncoded(body);
        if (!verifyCsrf(session.id, form.csrf || '')) return sendHtml(res, 400, 'CSRF doğrulanamadı');
        const admin = readJson(path.join(DATA_DIR, 'admin.json'), null);
        if (!admin) return sendHtml(res, 500, 'Admin yapılandırması eksik');
        const currentHash = crypto.scryptSync(form.current || '', admin.salt, 64).toString('hex');
        if (!crypto.timingSafeEqual(Buffer.from(currentHash, 'hex'), Buffer.from(admin.hash, 'hex'))) {
          return redirect(res, '/admin/ayarlar?flash=Mevcut+%C5%9Fifre+yanl%C4%B1%C5%9F');
        }
        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = crypto.scryptSync(form.next || '', newSalt, 64).toString('hex');
        writeJson(path.join(DATA_DIR, 'admin.json'), { username: admin.username, salt: newSalt, hash: newHash });
        return redirect(res, '/admin/ayarlar?flash=%C5%9Eifre+g%C3%BCncellendi');
      }
      if (method === 'GET' && pathname === '/admin/mesajlar') {
        const messages = readJson(path.join(DATA_DIR, 'messages.json'), []);
        return sendHtml(res, 200, renderAdminMessages(messages));
      }
      if (method === 'POST' && pathname === '/admin/mesajlar/sil') {
        const body = await readBody(req);
        const form = parseFormUrlEncoded(body);
        const ids = Array.isArray(form.id) ? form.id : (form.id ? [form.id] : []);
        const messages = readJson(path.join(DATA_DIR, 'messages.json'), []);
        const filtered = messages.filter(m => !ids.includes(m.id));
        writeJson(path.join(DATA_DIR, 'messages.json'), filtered);
        return redirect(res, '/admin/mesajlar');
      }
      if (method === 'GET' && pathname === '/admin/logout') {
        const cookiesOut = [setCookie('session', '', { maxAge: 0 })];
        return redirect(res, '/admin/login', cookiesOut);
      }

      res.writeHead(404).end('Admin route not found');
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sayfa bulunamadı');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sunucu hatası');
  }
}

// ---------------- Bootstrap ----------------
ensureDir(DATA_DIR);
ensureDir(PUBLIC_DIR);

if (process.argv.includes('--init')) {
  ensureSetup();
  process.exit(0);
}

ensureSetup();

const server = http.createServer(router);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`AjansKurumsal çalışıyor: http://localhost:${PORT}`);
});