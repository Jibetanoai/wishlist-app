// LINEログインの認可コードをアクセストークンに交換し、LINEのuserIdを取得する。
// channel secretはここ(Netlifyの環境変数)だけで扱い、クライアント側には渡さない。
//
// このアプリは「ユーザーごとに自分だけのリストを持てる」仕組みなので、単に
// ログイン成功/失敗を返すだけでなく、以後のデータ読み書き(data-get/data-write)を
// 誰のものとして扱うかを決める必要がある。そこで、ここでLINEのuserIdを確認した後、
// サーバー側だけが知っているSESSION_SECRETでuserIdに署名した「セッショントークン」を
// 発行してクライアントに渡す。クライアントはそれを毎回data-get/data-writeに添えて送り、
// サーバー側は署名を検証してuserIdを取り出す(生のuserIdをクライアントから
// そのまま送らせると、他人のuserIdを推測して指定するだけで他人のデータを
// 読み書きできてしまうため)。
const { signSessionToken } = require('./_session');

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

  const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = payload;
  if (!code || !redirectUri || !codeVerifier) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!channelId || !channelSecret || !sessionSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
    code_verifier: codeVerifier,
  });

  let tokenRes;
  try {
    tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'LINE request failed' }) };
  }

  if (!tokenRes.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Login failed' }) };
  }

  const tokenData = await tokenRes.json();

  let profile;
  try {
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) throw new Error('profile fetch failed');
    profile = await profileRes.json();
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Profile fetch failed' }) };
  }

  const sessionToken = signSessionToken(profile.userId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      name: profile.displayName || null,
      picture: profile.pictureUrl || null,
      sessionToken,
    }),
  };
};
