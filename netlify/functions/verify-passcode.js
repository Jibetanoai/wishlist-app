// パスコードが合ってるかだけを確認する専用エンドポイント。
// 以前はdata-write.jsへの書き込みでパスコードを検証していたが、それだと
// ページを開いた時点の(古いかもしれない)データで上書きしてしまう危険があった
// (他の端末が先に編集していた場合、その変更が消えてしまう)。
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

  const { passcode } = payload;
  const expected = process.env.EDIT_PASSCODE;
  if (!expected) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }
  if (!passcode || passcode !== expected) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Wrong passcode' }) };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
