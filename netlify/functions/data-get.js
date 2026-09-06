// リスト(ほしい物・やりたいこと・行きたいところ)のデータをNetlify Blobsから読み取る。
// 誰でも(家族・友人も)閲覧できるように、認証は一切かけない公開エンドポイント。
const { getStore } = require('@netlify/blobs');

const EMPTY_DATA = { wishlist: [], bucketlist: [], travellist: [], restaurantlist: [], hotellist: [], cafelist: [] };

exports.handler = async () => {
  try {
    const store = getStore('wishlist-data');
    const data = await store.get('main', { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || EMPTY_DATA),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load data', debug: String(err && err.stack || err) }) };
  }
};
