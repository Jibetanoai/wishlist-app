// 共有されたURLのタイトルとプレビュー画像だけを軽く取得する。
// 商品データベースを丸ごと読み取るような話ではなく、LINEやSlackにURLを貼ると
// 出てくる「プレビューカード」と同じ仕組み(ページの<title>やog:image等の
// メタ情報を見に行くだけ)。取得できなくても致命的ではないので、失敗時は
// title/imageともnullを返すだけにしておく。
const https = require('https');

// Netlify Functionsの実行時間の上限(だいたい10秒)を超えてプロセスごと
// 強制終了されないよう、リダイレクトを何度も追いかけても合計の残り時間内に
// 収まるようにする(deadlineで管理し、超えそうならそこで諦める)。
function fetchHtml(url, deadline, hopsLeft = 3) {
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
    const remaining = deadline - Date.now();
    if (remaining < 500) {
      reject(new Error('deadline exceeded'));
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
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hopsLeft > 0) {
          res.resume();
          fetchHtml(new URL(res.headers.location, target).toString(), deadline, hopsLeft - 1).then(resolve, reject);
          return;
        }
        let body = '';
        let size = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        };
        res.on('data', (chunk) => {
          size += chunk.length;
          body += chunk;
          if (size > 500000) {
            // 500KBに達したらそこで打ち切る。destroy()すると'end'が
            // 来ない場合があるため、ここで確定させてしまう。
            req.destroy();
            finish();
          }
        });
        res.on('end', finish);
        res.on('close', finish);
      },
    );
    req.on('error', reject);
    req.setTimeout(Math.min(6000, remaining), () => req.destroy(new Error('timeout')));
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

// ページに埋め込まれてる価格情報を探す。og:price:amountか、多くの通販サイトが
// SEO用に載せているJSON-LD(schema.org Product/Offer)のpriceを見に行くだけで、
// 商品データベースを読み取るような話ではない。
function extractPrice(html) {
  const ogPrice = extractMeta(html, ['og:price:amount', 'product:price:amount']);
  if (ogPrice) {
    const n = Number(String(ogPrice).replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n) && n > 0) return Math.round(n);
  }

  // 巨大なJSON-LD(何百件もの商品バリエーションを含むカタログデータ等)を
  // 同期的にフルパースすると処理が固まって関数ごと落ちることがあるため、
  // ブロック数・サイズ・配列の走査件数のすべてに上限を設けて安全にする。
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptCount = 0;
  while ((match = scriptRegex.exec(html)) && scriptCount < 5) {
    scriptCount++;
    const raw = match[1];
    if (raw.length > 200000) continue; // 巨大すぎるブロックはスキップ
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const price = findPriceInJsonLd(data);
    if (price != null) return price;
  }
  return null;
}

function findPriceInJsonLd(node, depth = 0) {
  if (!node || depth > 5) return null;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 20)) {
      const p = findPriceInJsonLd(item, depth + 1);
      if (p != null) return p;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  if (node.price != null) {
    const n = Number(String(node.price).replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n) && n > 0) return Math.round(n);
  }
  for (const key of ['offers', '@graph', 'itemOffered']) {
    if (node[key] != null) {
      const p = findPriceInJsonLd(node[key], depth + 1);
      if (p != null) return p;
    }
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

  // Amazon・楽天はデータセンターからのアクセスを事実上ブロックしていて、毎回
  // 503またはタイムアウトになるだけなので、無駄に待たせずに最初から諦める
  // (ここは今まで通り手動入力してもらう)。
  if (/amazon\.co\.jp|rakuten\.co\.jp/i.test(url)) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null, price: null }) };
  }

  let result;
  try {
    result = await fetchHtml(url, Date.now() + 8000);
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null, price: null }) };
  }

  try {
    const html = result.body;
    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const rawTitle = extractMeta(html, ['og:title', 'twitter:title']) || (titleTagMatch ? titleTagMatch[1] : null);
    const rawImage = extractMeta(html, ['og:image', 'twitter:image']);
    const price = extractPrice(html);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: rawTitle ? decodeEntities(rawTitle).trim().slice(0, 200) : null,
        image: rawImage || null,
        price,
      }),
    };
  } catch {
    // ページの中身の解析でここまで来て失敗しても、致命的にはしない。
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: null, image: null, price: null }) };
  }
};
