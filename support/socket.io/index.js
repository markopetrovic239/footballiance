import socketio from 'socket.io'
import {
  EventEmitter as emitter
} from 'events'
// import logger from '../../utils/logger'
const config = rootRequire('config')

const em = new emitter()

const listen = (server) => {
  if (!server) { return }

  if (config.socket && !config.socket.enable) {
    return
  }

  const io = socketio.listen(server)
  io.sockets.setMaxListeners(0)

  // io.on('connection', function(socket) {
  // 	logger.info('connection established!!!')
  // 	em.emit('io', io)
  // })

  setTimeout(() => {
    em.emit('io', io)
  }, 300)
}

// bind listen function to event
em.listen = listen

module.exports = em
