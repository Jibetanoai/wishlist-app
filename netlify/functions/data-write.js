// ログイン中のユーザー本人のリストデータを書き込む。セッショントークンから
// userIdを検証し、そのユーザー専用のドキュメントにだけ書き込む。
const { getWishlistStore } = require('./_blobStore');
const { verifySessionToken } = require('./_session');

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

  const userId = verifySessionToken(payload.sessionToken);
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'ログインが必要だよ' }) };
  }

  const { data } = payload;
  if (!data || typeof data !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
  }

  try {
    const store = getWishlistStore();
    await store.setJSON(`user:${userId}`, data);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save data' }) };
  }
};
