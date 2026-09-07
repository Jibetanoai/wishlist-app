// Yahoo!ショッピング商品検索API(公式・無料)。楽天と同じ検索キーワードで
// 同時に呼び出し、2つのサイトの結果をまとめて出せるようにするためのもの。
const https = require('https');

const YAHOO_HOST = 'shopping.yahooapis.jp';
const YAHOO_PATH = '/ShoppingWebService/V3/itemSearch';

function requestYahoo(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: YAHOO_HOST, path, method: 'GET' },
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

  const appid = process.env.YAHOO_CLIENT_ID;
  if (!appid) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const params = new URLSearchParams({
    appid,
    query: keyword,
    results: '20',
    sort: '-score', // 関連度順
  });

  let res;
  try {
    res = await requestYahoo(`${YAHOO_PATH}?${params.toString()}`);
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Yahoo!への通信に失敗したよ' }) };
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Yahoo!からエラーが返ってきたよ' }) };
  }

  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Yahoo!の応答を読み取れなかったよ' }) };
  }

  const items = (data.hits || []).map((hit) => ({
    name: hit.name,
    price: hit.price,
    url: hit.url,
    image: (hit.image && (hit.image.medium || hit.image.small)) || null,
    shopName: hit.seller && hit.seller.name,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  };
};
