// リストデータの書き込み。パスコードが合ってる時だけ書き込みを許可する。
// パスコードはNetlifyの環境変数(EDIT_PASSCODE)にだけ保存し、クライアント側コードには
// 一切書かない。閲覧は誰でもできるが、編集はKさんだけができるようにするための仕組み。
const { getStore } = require('@netlify/blobs');

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

  const { passcode, data } = payload;
  const expected = process.env.EDIT_PASSCODE;
  if (!expected) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }
  if (!passcode || passcode !== expected) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Wrong passcode' }) };
  }
  if (!data || typeof data !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
  }

  try {
    const store = getStore('wishlist-data');
    await store.setJSON('main', data);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save data' }) };
  }
};
