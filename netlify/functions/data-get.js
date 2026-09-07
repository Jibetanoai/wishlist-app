// ログイン中のユーザー本人のリストデータを読み取る。セッショントークンから
// userIdを検証し、そのユーザー専用のドキュメントだけを返す(他人のデータは
// 見えない)。
const { getWishlistStore } = require('./_blobStore');
const { verifySessionToken } = require('./_session');

const EMPTY_DATA = { wishlist: [], bucketlist: [], travellist: [], restaurantlist: [], hotellist: [], cafelist: [], furusatolist: [] };

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

  try {
    const store = getWishlistStore();
    const data = await store.get(`user:${userId}`, { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || EMPTY_DATA),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load data' }) };
  }
};
