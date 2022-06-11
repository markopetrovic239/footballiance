import logger from '../../../utils/logger'
const config = rootRequire('config')

module.exports = (req, res, next) => {
  if (!config.jwtTokenVerificationEnable) { // skip user verification
    return next()
  }

  if (!req.user || (req.user && !req.user._id)) {
    return res.status(401).json({
      status: 0,
      message: 'invalid user.'
    })
  }

  // check into db user exists or not
  // UserSchema
  //     .findOne({ _id: req.user._id })
  //     .select({ password: 0 })
  //     .lean()
  //     .exec(function(err, user) {
  //         if (err) {
  //             logger.info('Error while getting login user details : ', err)
  //             return res.status(500).json({ status: 0, message: 'Server error.' }) // send server error
  //         }

  //         if (!user) { // if not found user for this id
  //             return res.status(401).json({ status: 0, message: 'invalid user.' })
  //         }

  //         req.user = user // store user in request parameter
  //         next()
  //     })

  // OR

  next()
}
