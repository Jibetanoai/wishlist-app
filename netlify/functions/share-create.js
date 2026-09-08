// ログイン中の本人が「公開ページを作る」を押した時に呼ぶ。本人確認だけ行い、
// 以後ログインなしで自分のほしい物リストを読める公開トークンを発行する。
// トークン自体は誰でも作れてしまうと意味がないので、必ずセッショントークンで
// 本人確認してから発行する(userIdはトークンの外からは推測できない)。
const { verifySessionToken, signShareToken } = require('./_session');

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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shareToken: signShareToken(userId) }),
  };
};
