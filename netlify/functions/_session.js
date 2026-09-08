// line-token-exchange.jsで発行したセッショントークンを検証し、userIdを取り出す。
// 署名が正しくなければ(=本人以外がuserIdを偽装しようとした場合)nullを返す。
const crypto = require('crypto');

function sign(message, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return `${Buffer.from(message).toString('base64url')}.${hmac}`;
}

function signSessionToken(userId) {
  return sign(userId, process.env.SESSION_SECRET);
}

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
  // 共有トークン(signShareTokenで作る"share:"接頭辞付きメッセージ)がそのまま
  // セッショントークンとして送られてきた場合に通してしまわないようにする。
  if (userId.startsWith('share:')) return null;

  const expected = crypto.createHmac('sha256', secret).update(userId).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  return userId;
}

// 公開共有リンク用のトークン。ログインセッションのトークンとは署名対象の
// 文字列("share:"接頭辞)を変えることで、片方が漏れてももう片方としては
// 使えないようにしている(セッショントークンと共有トークンの使い道の混同防止)。
function signShareToken(userId) {
  return sign(`share:${userId}`, process.env.SESSION_SECRET);
}

function verifyShareToken(shareToken) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !shareToken || typeof shareToken !== 'string') return null;

  const parts = shareToken.split('.');
  if (parts.length !== 2) return null;
  const [encodedMessage, signature] = parts;

  let message;
  try {
    message = Buffer.from(encodedMessage, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!message || !message.startsWith('share:')) return null;

  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  return message.slice('share:'.length);
}

module.exports = { signSessionToken, verifySessionToken, signShareToken, verifyShareToken };
