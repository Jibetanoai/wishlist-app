// line-token-exchange.jsで発行したセッショントークンを検証し、userIdを取り出す。
// 署名が正しくなければ(=本人以外がuserIdを偽装しようとした場合)nullを返す。
const crypto = require('crypto');

function verifySessionToken(sessionToken) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !sessionToken || typeof sessionToken !== 'string') return null;

  const parts = sessionToken.split('.');
  if (parts.length !== 2) return null;
  const [encodedUserId, signature] = parts;

  let userId;
  try {
    userId = Buffer.from(encodedUserId, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = crypto.createHmac('sha256', secret).update(userId).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  return userId;
}

module.exports = { verifySessionToken };
