import logger from '../../../utils/logger'
const AESCrypt = rootRequire('utils/aes')

var _self = {
  test: (socket, nsp, data, CB) => {
    CB({
      'status': 1,
      'message': 'Great! Connected to server',
      data: data
    })
  },

  disconnect: (socket, data, CB) => {
    logger.info('[SUCCESS] Client Disconnected:', socket.id, data)
  },

  encode: (response) => {
    try {
      if (response && typeof response.data !== 'undefined') {
        response.data = JSON.stringify(response.data)
        response.data = AESCrypt.encrypt(response.data)
      } else {
        response.data = ''
      }
    } catch (e) {
      response = response
    }

    return response
  }
}

module.exports = _self
