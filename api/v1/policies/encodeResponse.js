import HttpStatus from 'http-status-codes'
const config = rootRequire('config')
const AESCrypt = rootRequire('utils/aes')

module.exports = (request, response, next) => {
  if (request.method === 'OPTIONS') {
    return next()
  }

  // send server error if response does not exit
  if (!request.resbody || typeof request.resbody !== 'object') {
    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({
        status: 0,
        message: HttpStatus.getStatusText(HttpStatus.INTERNAL_SERVER_ERROR)
      })
  }

  if (config.cryptoEnable === true && request.sourceOfRequest !== 'web') {
    // send response with encryption
    if (typeof request.resbody.data !== 'undefined') {
      request.resbody.data = JSON.stringify(request.resbody.data)
      request.resbody.data = AESCrypt.encrypt(request.resbody.data)
    } else {
      request.resbody.data = ''
    }
    response
      .send(request.resbody)
  } else {
    // send response without encryption
    response
      .send(request.resbody)
  }
}
