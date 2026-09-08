// ログイン不要の公開エンドポイント。共有トークンからuserIdを検証し、その人が
// カテゴリごとに「公開する」に設定しているリストだけを読み取り専用で返す。
// 本人しか知らない情報(メモ・値下がり履歴など)は返さない。
const { getWishlistStore } = require('./_blobStore');
const { verifyShareToken } = require('./_session');

// バリューコマース等の提携プログラムはカテゴリ(飲食店・ホテル・ふるさと納税等)ごとに
// 個別審査のため、審査担当者が実際のアフィリエイトリンクを見られるよう、
// 「ほしい物」以外のリストも公開対象にできるようにしている。
const SECTIONS = [
  { key: 'wishlist', label: '🎁 ほしい物', type: 'wish' },
  { key: 'travellist', label: '✈️ 行きたいところ', type: 'simple' },
  { key: 'restaurantlist', label: '🍴 行きたい飲食店', type: 'simple' },
  { key: 'hotellist', label: '🏨 泊まりたいホテル', type: 'simple' },
  { key: 'cafelist', label: '☕ 行きたいカフェ', type: 'simple' },
  { key: 'furusatolist', label: '🎁 ふるさと納税', type: 'simple', hasAmount: true },
];

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
    const shareSettings = (data && data.shareSettings) || {};
    const enabledSections = SECTIONS.filter((s) => shareSettings[s.key]);
    if (!data || enabledSections.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'このリストは公開されていないよ' }) };
    }

    const sections = enabledSections.map((s) => {
      const list = data[s.key] || [];
      if (s.type === 'wish') {
        return {
          key: s.key, label: s.label, type: s.type,
          items: list.map((item) => ({
            id: item.id, title: item.title, price: item.price, image: item.image,
            url: item.url, purchased: !!item.purchased,
          })),
        };
      }
      return {
        key: s.key, label: s.label, type: s.type,
        items: list.map((item) => ({
          id: item.id, title: item.title, image: item.image, link: item.link,
          done: !!item.done, amount: s.hasAmount ? item.amount : undefined,
        })),
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: data.shareLabel || null, sections }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load data' }) };
  }
};
