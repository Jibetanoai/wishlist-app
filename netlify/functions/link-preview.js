// 共有されたURLのタイトルとプレビュー画像だけを軽く取得する。
// 商品データベースを丸ごと読み取るような話ではなく、LINEやSlackにURLを貼ると
// 出てくる「プレビューカード」と同じ仕組み(ページの<title>やog:image等の
// メタ情報を見に行くだけ)。取得できなくても致命的ではないので、失敗時は
// title/imageともnullを返すだけにしておく。
const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      reject(new Error('invalid url'));
      return;
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      reject(new Error('unsupported protocol'));
      return;
    }
    const lib = target.protocol === 'https:' ? https : require('http');
    const req = lib.request(
      target,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept: 'text/html',
        },
      },
      (res) => {
        // リダイレクトは1回だけ追いかける(商品リンクは短縮URL経由のことが多いため)。
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchHtml(new URL(res.headers.location, target).toString()).then(resolve, reject);
          return;
        }
        let body = '';
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 500000) { req.destroy(); return; } // 500KBで打ち切り
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on('error', reject);
    req.setTimeout(6000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function extractMeta(html, names) {
  for (const name of names) {
    let m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'));
    if (m) return m[1];
    m = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, 'i'));
    if (m) return m[1];
  }
  return null;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
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

  const url = payload.url;
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  let result;
  try {
    result = await fetchHtml(url);
  } catch (err) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null, debugError: String(err && err.message || err) }) };
  }

  const html = result.body;
  const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const rawTitle = extractMeta(html, ['og:title', 'twitter:title']) || (titleTagMatch ? titleTagMatch[1] : null);
  const rawImage = extractMeta(html, ['og:image', 'twitter:image']);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: rawTitle ? decodeEntities(rawTitle).trim().slice(0, 200) : null,
      image: rawImage || null,
      debugStatus: result.statusCode,
      debugContentEncoding: result.headers['content-encoding'] || null,
      debugHtmlLength: html.length,
      debugHtmlSnippet: html.slice(0, 300),
    }),
  };
};
