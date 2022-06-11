import crypto from 'crypto'

const algorithm = 'aes192'
const password = 'erqAFxxCshjKla'

export const encrypt = (text) => {
  var cipher = crypto.createCipher(algorithm, password)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted
}

export const decrypt = (text) => {
  var decipher = crypto.createDecipher(algorithm, password)
  var dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// var pwd = decrypt("16085e39f5d50ca556cfa4106c3f2997");
// console.log(pwd)
