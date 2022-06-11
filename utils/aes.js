import crypto from 'crypto'
const config = rootRequire('config')

export const decrypt = (encryptdata) => {
  encryptdata = Buffer.from(encryptdata, 'base64').toString('binary')
  let hashKey = crypto.createHash('sha256').update(config.cryptoKey).digest()
  let decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, config.cryptoIV)
  let decoded = decipher.update(encryptdata, 'binary', 'utf8')
  decoded += decipher.final('utf8')
  return decoded
}

export const encrypt = (cleardata) => {
  let hashKey = crypto.createHash('sha256').update(config.cryptoKey).digest()
  let encipher = crypto.createCipheriv('aes-256-cbc', hashKey, config.cryptoIV)
  let encryptdata = encipher.update(cleardata, 'utf8', 'binary')
  encryptdata += encipher.final('binary')
  let encoded = Buffer.from(encryptdata, 'binary').toString('base64')
  return encoded
}

// var json = { screen_type: 'all',
//   user_id: '58ec9d7f0017192176f234b9',
//   lat: 23.0215813,
//   lon: 72.5446066 };

// var enc = encrypt(JSON.stringify(json));
// console.log('ENC:', enc);

// var dec = decrypt("tmBq8A71zV6VdqlEB7PXsjeqJ7ZTqqpR+SLGudMUI1NkkoLQzbgSX54SyBPkNsRn36ILNwk+LQMy66bl9msa5bq2mad/181d1XCE10MKJk4V++YSwbChX+oIlKyP+BOI");
// console.log('2', JSON.parse(dec));
