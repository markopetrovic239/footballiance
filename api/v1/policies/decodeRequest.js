const config = rootRequire('config')
const AESCrypt = rootRequire('utils/aes')

module.exports = (req, res, next) => {
  // skip request
  if (req.url.indexOf('/verify/') > -1 && req.method === 'GET') {
    return next()
  } else if (req.url.indexOf('/reset/') > -1 && (req.method === 'GET' || req.method === 'POST')) {
    return next()
  } else if (req.url.indexOf('/setpassword/') > -1 && (req.method === 'GET' || req.method === 'POST')) {
    return next()
  } else if (req.method === 'POST' && req.headers && req.headers['content-type'] && req.headers['content-type'].indexOf('multipart') > -1) {
    return next()
  }

  // skip to decode code for web request for development
  if (req.sourceOfRequest === 'web') {
    return next()
  }

  // skip to decode code
  if (!config.cryptoEnable) {
    return next()
  }

  if (req.body.encoded) {
    try {
      var dec = AESCrypt.decrypt(req.body.encoded);
      req.body = JSON.parse(dec);
    } catch (err) {
      return res.status(400).json({
        status: 0,
        message: 'Failed to decode data.'
      })
    }

    next()
  } else if (req.query.encoded) {
    try {
      var dec = AESCrypt.decrypt(req.query.encoded)
    } catch (err) {
      return res.status(400).json({
        status: 0,
        message: 'Failed to decode data.'
      })
    }
    req.query = JSON.parse(dec)
    next()
  } else {
    res.status(400).json({
      status: 0,
      message: 'Request is not autherized.'
    })
  }
}
