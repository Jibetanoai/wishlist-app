// 楽天市場商品検索(公式・無料の楽天ウェブサービスAPI)。
// 2026年7月版のAPIはapplicationId・accessKeyの両方が必須で、さらに
// Allowed websitesに登録したサイトからのアクセスかをRefererヘッダーで
// 確認する仕様。Node.jsのfetch()は仕様上Refererヘッダーを上書きできない
// (ブラウザと同じ「forbidden header」扱いのため)ので、httpsモジュールで
// 直接リクエストを組み立てて回避する。
const https = require('https');

const RAKUTEN_HOST = 'openapi.rakuten.co.jp';
const RAKUTEN_PATH = '/ichibams/api/IchibaItem/Search/20260701';

function requestRakuten(path, referer) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: RAKUTEN_HOST,
        path,
        method: 'GET',
        headers: { Referer: referer },
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

  const keyword = (payload.keyword || '').trim();
  if (!keyword) {
    return { statusCode: 400, body: JSON.stringify({ error: 'キーワードを入力してね' }) };
  }

  const applicationId = process.env.RAKUTEN_APP_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID; // 未設定でも検索自体は動く

  if (!applicationId || !accessKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const params = new URLSearchParams({
    applicationId,
    accessKey,
    keyword,
    hits: '10',
    sort: '+itemPrice',
    format: 'json',
  });
  if (affiliateId) params.set('affiliateId', affiliateId);

  // process.env.URLはNetlifyが自動で設定する、このサイト自身のURL。
  const referer = process.env.URL || 'https://famous-biscochitos-f8ab60.netlify.app';

  let res;
  try {
    res = await requestRakuten(`${RAKUTEN_PATH}?${params.toString()}`, referer);
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: '楽天への通信に失敗したよ' }) };
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return { statusCode: 502, body: JSON.stringify({ error: '楽天からエラーが返ってきたよ', debugStatus: res.statusCode, debugBody: res.body }) };
  }

  const data = JSON.parse(res.body);
  const items = (data.Items || []).map((wrap) => {
    const item = wrap.Item || wrap;
    return {
      name: item.itemName,
      price: item.itemPrice,
      url: item.affiliateUrl || item.itemUrl,
      image: (item.mediumImageUrls && item.mediumImageUrls[0] && (item.mediumImageUrls[0].imageUrl || item.mediumImageUrls[0])) || null,
      shopName: item.shopName,
    };
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  };
};
