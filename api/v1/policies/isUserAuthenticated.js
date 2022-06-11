import logger from '../../../utils/logger'
import jwt from 'jsonwebtoken'
const config = rootRequire('config')

module.exports = (req, res, next) => {
  if (!config.jwtTokenVerificationEnable) { // skip token verification
    return next()
  }

  // Get token from headers
  var reqToken = req.headers ? req.headers['authorization'] : ''

  // verify a token symmetric
  jwt.verify(reqToken, config.secret, (err, decoded) => {
    if (err) {
      logger.info('ERROR: ' + err.message)
      res.status(401).json({
        status: 0,
        message: err.message
      })
    } else if (decoded && decoded._id) {
      // logger.info('DECODED:', decoded._doc);

      // store user in request (user)
      req.user = decoded
      next()
    } else {
      // send Unauthorized response
      res.status(401).json({
        status: 0,
        message: 'something wrong.'
      })
    }
  })
}
