// Menghasilkan feed.xml (RSS 2.0) dari news.json.
// Dipakai untuk newsletter otomatis (RSS-to-Email) di layanan seperti
// Mailchimp / Brevo / MailerLite. Dijalankan otomatis oleh GitHub Actions.

const fs = require('fs');
const path = require('path');

// GANTI dengan domain situs kamu setelah online (mis. https://kabarmarket.com)
const SITE_URL = 'https://kabarmarket.web.id';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function run() {
  const src = path.join(__dirname, '..', 'news.json');
  const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const now = data.updated || new Date().toISOString();
  const build = new Date(now).toUTCString();

  const items = articles.map((a) => {
    const link = a.url || (SITE_URL + '/#berita');
    const desc = a.desc || (Array.isArray(a.body) ? a.body.join(' ') : '');
    const cat = a.cat || 'Berita';
    return [
      '    <item>',
      '      <title>' + esc(a.title) + '</title>',
      '      <link>' + esc(link) + '</link>',
      '      <guid isPermaLink="false">' + esc(a.url || a.title) + '</guid>',
      '      <category>' + esc(cat) + '</category>',
      '      <pubDate>' + build + '</pubDate>',
      '      <description>' + esc(desc) + '</description>',
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Kabar Market \u2014 Berita Ekonomi, Saham &amp; Crypto</title>',
    '    <link>' + SITE_URL + '</link>',
    '    <description>Ringkasan berita ekonomi, saham, dan crypto pilihan dari Kabar Market.</description>',
    '    <language>id</language>',
    '    <lastBuildDate>' + build + '</lastBuildDate>',
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  const dest = path.join(__dirname, '..', 'feed.xml');
  fs.writeFileSync(dest, xml, 'utf-8');

  // Perbarui tanggal sitemap.xml agar Google tahu ada konten baru
  const today = new Date().toISOString().slice(0, 10);
  const pageList = [
    ['/', '1.0', 'hourly'],
    ['/berita.html', '0.9', 'hourly'],
    ['/ekonomi.html', '0.9', 'hourly'],
    ['/saham.html', '0.9', 'hourly'],
    ['/crypto.html', '0.9', 'hourly'],
    ['/edukasi.html', '0.8', 'weekly'],
    ['/tentang.html', '0.5', 'monthly'],
    ['/dukung.html', '0.5', 'monthly'],
  ];
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ].concat(pageList.map(function(p){
    return [
      '  <url>',
      '    <loc>' + SITE_URL + p[0] + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>' + p[2] + '</changefreq>',
      '    <priority>' + p[1] + '</priority>',
      '  </url>',
    ].join('\n');
  })).concat(['</urlset>', '']).join('\n');
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), sitemap, 'utf-8');

  console.log('OK: feed.xml + sitemap.xml diperbarui (' + articles.length + ' berita)');
}

run();
