import util from 'util'
import FCM from 'fcm-push'
import apn from 'apn'
import _ from 'underscore'
import fs from 'fs'
import logger from '../../utils/logger'

const config = rootRequire('config')
const _config = {
  'passphrase': 'admin',
  'production': true,
  'key': fs.readFileSync(`${__dirname}/pemFiles/cert.pem`),
  'cert': fs.readFileSync(`${__dirname}/pemFiles/cert.pem`),
  'debug': true
}
const apnProvider = new apn.Provider(_config)
let _self = {
  /**
   * FCM Push Notification
   **/
  fcm: (options, callback) => {
    let fcm = new FCM(config.notification.androidApiKey);
    let message = {
      to: options.to, // required fill with device token or topics
      data: options.data || {}
    }
    fcm.send(message, callback)
  },

  /**
   * APN Push Notification
   **/
  apn: (options, callback) => {
    var note = new apn.Notification()
    note.expiry = Math.floor(Date.now() / 1000) + 3600
    note.badge = 0
    note.sound = 'default'
    note.alert = 'xCode'
    note.topic = 'com.app.xCode'
    note.contentAvailable = 1
    note.payload = {
      body: {}
    }

    // assign clone of data to payload body
    if (options && options.data && options.data.message) {
      note.alert = options.data.message
      note.payload.body = _.clone(options.data)
      delete note.payload.body['message']
      delete note.payload.body['title']
    }

    apnProvider.send(note, options.to).then((result) => {
      logger.info('\n result:', util.inspect(result, {
        showHidden: false,
        depth: null
      }))
      callback()
    })
  }
}

module.exports = _self

// setTimeout(function() {
//     _self.apn({
//         to: 'B75BFCDFD7A8E946E330E4A4407FE351692C7A1595C748F5546934E3E91C6097',
//         data: {
//             message: 'test',
//             sender_id: 'sadsad'
//         }
//     });
// }, 2000);
