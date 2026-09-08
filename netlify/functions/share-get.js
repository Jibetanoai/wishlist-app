// ログイン不要の公開エンドポイント。共有トークンからuserIdを検証し、その人が
// 「公開する」に設定している場合だけ、ほしい物リストを読み取り専用で返す。
// 本人しか知らない情報(メモ・値下がり履歴など)は返さない。
const { getWishlistStore } = require('./_blobStore');
const { verifyShareToken } = require('./_session');

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

  const userId = verifyShareToken(payload.shareToken);
  if (!userId) {
    return { statusCode: 404, body: JSON.stringify({ error: 'このリンクは無効だよ' }) };
  }

  try {
    const store = getWishlistStore();
    const data = await store.get(`user:${userId}`, { type: 'json' });
    if (!data || !data.shareEnabled) {
      return { statusCode: 404, body: JSON.stringify({ error: 'このリストは公開されていないよ' }) };
    }

    const items = (data.wishlist || []).map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      url: item.url,
      purchased: !!item.purchased,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: data.shareLabel || null, items }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load data' }) };
  }
};
