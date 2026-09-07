// 楽天の商品ページURL(item.rakuten.co.jp/ショップ名/商品URL/)から、公式の
// 商品検索APIでitemCode指定検索をして、正式な商品名・画像・価格を取得する。
// ページを直接読みに行く(スクレイピング)のではなく、rakuten-search.jsと同じ
// 公式APIを使う方式なので、規約的にも問題ない。
const https = require('https');

const RAKUTEN_HOST = 'openapi.rakuten.co.jp';
const RAKUTEN_PATH = '/ichibams/api/IchibaItem/Search/20260701';

function requestRakuten(path, referer, accessKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: RAKUTEN_HOST,
        path,
        method: 'GET',
        headers: { Referer: referer, Origin: referer, accessKey },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// item.rakuten.co.jp/ショップ名/商品URL/ から itemCode(ショップ名:商品URL)を作る。
function extractItemCode(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)rakuten\.co\.jp$/i.test(parsed.hostname)) return null;
  const m = parsed.pathname.match(/^\/([^/]+)\/([^/?]+)/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const itemCode = extractItemCode(payload.url || '');
  if (!itemCode) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  const applicationId = process.env.RAKUTEN_APP_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  if (!applicationId || !accessKey) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  const params = new URLSearchParams({ applicationId, accessKey, itemCode, hits: '1', format: 'json' });
  const referer = process.env.URL || 'https://famous-biscochitos-f8ab60.netlify.app';

  let res;
  try {
    res = await requestRakuten(`${RAKUTEN_PATH}?${params.toString()}`, referer, accessKey);
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  const wrap = (data.Items || [])[0];
  const item = wrap && (wrap.Item || wrap);
  if (!item) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: item.itemName || null,
      image: (item.mediumImageUrls && item.mediumImageUrls[0] && (item.mediumImageUrls[0].imageUrl || item.mediumImageUrls[0])) || null,
      price: item.itemPrice ?? null,
    }),
  };
};
