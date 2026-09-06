// 楽天市場商品検索(公式・無料の楽天ウェブサービスAPI)。
// 2026年7月版のAPIはapplicationId・accessKeyの両方が必須。affiliateIdは
// 検索結果にアフィリエイトリンクを自動で付けてもらうための鍵。どれも
// Netlifyの環境変数にだけ置き、クライアント側コードには一切書かない。
const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701';

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

  let res;
  try {
    res = await fetch(`${RAKUTEN_ENDPOINT}?${params.toString()}`);
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: '楽天への通信に失敗したよ' }) };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { statusCode: 502, body: JSON.stringify({ error: '楽天からエラーが返ってきたよ', debugStatus: res.status, debugBody: errBody }) };
  }

  const data = await res.json();
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
