import logger from '../../../utils/logger'
const SocketIO = rootRequire('support/socket.io')
const UserController = require('../socketControllers/userSocketController.js')
const DecodeSocketRequestPolicy = require('../policies/decodeSocketRequest.js')

exports.init = (app, apiBase) => {
  SocketIO.on('io', (io) => {
    let nsp = io.of(apiBase + '/xcode')
    nsp.on('connection', (socket) => {
      logger.info('client connection established :->', socket.id)

      // to decode request parameters
      socket.use(DecodeSocketRequestPolicy)
      socket.emit('connected', 'You are connected.')
      socket.on('test', UserController.test.bind(null, socket, nsp))
      socket.on('disconnect', UserController.disconnect.bind(null, socket))
    })
  })
}
