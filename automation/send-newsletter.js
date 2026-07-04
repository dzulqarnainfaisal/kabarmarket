// Kirim newsletter mingguan Kabar Market ke pelanggan via API Brevo.
// Dijalankan otomatis oleh GitHub Actions tiap Senin 06.30 WIB.
const fs = require('fs');

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = parseInt(process.env.BREVO_LIST_ID || '0', 10);
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'kabarmarket1@gmail.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Kabar Market';
const SITE = 'https://kabarmarket.web.id';
const MAX = 8;

if (!API_KEY) { console.error('BREVO_API_KEY belum diset'); process.exit(1); }
if (!LIST_ID) { console.error('BREVO_LIST_ID belum diset'); process.exit(1); }

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const data = JSON.parse(fs.readFileSync('news.json','utf8'));
let articles = Array.isArray(data) ? data : (data.articles || []);
articles = articles.slice(0, MAX);
if (!articles.length) { console.error('Tidak ada berita, batal kirim.'); process.exit(0); }

const catUrl = c => ({Ekonomi:'/ekonomi.html', Saham:'/saham.html', Crypto:'/crypto.html'}[c] || '/berita.html');
const catColor = c => ({Ekonomi:'#5B8DEF', Saham:'#22B27D', Crypto:'#E7A33E'}[c] || '#7C8A9C');

const today = new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Jakarta'});

const items = articles.map(a => {
  const link = a.url || (SITE + catUrl(a.cat));
  return '<tr><td style="padding:0 0 22px;">'
    + '<span style="display:inline-block;font:700 11px Arial,sans-serif;color:#fff;background:'+catColor(a.cat)+';padding:3px 9px;border-radius:20px;letter-spacing:.5px;">'+esc((a.cat||'').toUpperCase())+'</span>'
    + '<h2 style="margin:10px 0 6px;font:700 19px Arial,sans-serif;color:#0B1420;line-height:1.35;"><a href="'+esc(link)+'" style="color:#0B1420;text-decoration:none;">'+esc(a.title)+'</a></h2>'
    + '<p style="margin:0 0 8px;font:400 14px/1.6 Arial,sans-serif;color:#4a5568;">'+esc(a.desc)+'</p>'
    + '<a href="'+esc(link)+'" style="font:700 13px Arial,sans-serif;color:#1170ff;text-decoration:none;">Baca selengkapnya &rarr;</a>'
    + '</td></tr>';
}).join('');

const html = '<!doctype html><html><body style="margin:0;background:#eef1f5;padding:24px 0;">'
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
  + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;">'
  + '<tr><td style="background:#0B1420;padding:22px 28px;">'
  + '<img src="'+SITE+'/assets/logo-header.png?v=2" width="40" height="40" alt="Kabar Market" style="vertical-align:middle;border-radius:8px;">'
  + '<span style="font:700 20px Arial,sans-serif;color:#fff;vertical-align:middle;margin-left:10px;">Kabar Market</span>'
  + '</td></tr>'
  + '<tr><td style="padding:24px 28px 6px;">'
  + '<p style="margin:0 0 4px;font:700 15px Arial,sans-serif;color:#0B1420;">Ringkasan Berita Pekan Ini</p>'
  + '<p style="margin:0 0 18px;font:400 13px Arial,sans-serif;color:#7C8A9C;">'+esc(today)+'</p>'
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+items+'</table>'
  + '</td></tr>'
  + '<tr><td style="padding:8px 28px 26px;">'
  + '<a href="'+SITE+'" style="display:inline-block;background:#1170ff;color:#fff;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:8px;">Kunjungi Kabar Market</a>'
  + '</td></tr>'
  + '<tr><td style="background:#f5f7fa;padding:18px 28px;font:400 12px Arial,sans-serif;color:#98a2b3;text-align:center;">'
  + 'Kamu menerima email ini karena berlangganan newsletter Kabar Market.<br>'
  + '<a href="{{ unsubscribe }}" style="color:#98a2b3;">Berhenti berlangganan</a>'
  + '</td></tr>'
  + '</table></td></tr></table></body></html>';

const campaign = {
  name: 'Newsletter Kabar Market - ' + new Date().toISOString().slice(0,10),
  subject: 'Kabar Market Pekan Ini - ' + articles[0].title.slice(0,60),
  sender: { name: SENDER_NAME, email: SENDER_EMAIL },
  type: 'classic',
  htmlContent: html,
  recipients: { listIds: [LIST_ID] }
};

(async () => {
  const r1 = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(campaign)
  });
  const t1 = await r1.text();
  if (!r1.ok) { console.error('Gagal membuat campaign:', r1.status, t1); process.exit(1); }
  const id = JSON.parse(t1).id;
  console.log('Campaign dibuat, id =', id);

  const r2 = await fetch('https://api.brevo.com/v3/emailCampaigns/' + id + '/sendNow', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'accept': 'application/json' }
  });
  if (!r2.ok) { const t2 = await r2.text(); console.error('Gagal mengirim:', r2.status, t2); process.exit(1); }
  console.log('Newsletter terkirim ke list', LIST_ID, '-', articles.length, 'berita.');
})();
