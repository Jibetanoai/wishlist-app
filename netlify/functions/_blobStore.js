// Netlify Blobsの自動環境設定(getStore('name')だけで動くはずの仕組み)が
// この環境ではうまく働かなかったため、サイトID・アクセストークンを明示的に
// 渡すフォールバック方式にしている。どちらもNetlifyの環境変数にだけ置く。
const { getStore } = require('@netlify/blobs');

function getWishlistStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'wishlist-data', siteID, token });
  }
  return getStore('wishlist-data');
}

module.exports = { getWishlistStore };
