import fse from 'fs-extra'
import path from 'path'
import formidable from 'formidable'
import gm from 'gm'
import logger from '../../utils/logger'

const config = rootRequire('config')
const AESCrypt = rootRequire('utils/aes')

gm.subClass({
  imageMagick: true
})

var _self = {

  getFormFields: (req, callback) => {
    var form = new formidable.IncomingForm()

    // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true

    // store all uploads in the /uploads directory
    form.uploadDir = path.join(rootPath, '/uploads/tmp');

    // create a directory
    fse.mkdirs(form.uploadDir, (err) => {
      if (err) {
        return callback(err, null, null)
      }

      // log any errors that occur
      form.on('error', (err) => {
        logger.error('An error has occured: \n' + err)
      })

      // once all the files have been uploaded, send a response to the client
      form.on('end', () => {
        // logger.info('FORM END!');
      })

      // parse the incoming request containing the form data
      form.parse(req, (err, fields, files) => {

        // skip to decode code for web request for development
        if (req.sourceOfRequest === 'web') {
          return callback(err, fields, files)
        }

        // skip to decode code
        if (!config.cryptoEnable) {
          return callback(err, fields, files)
        }

        // check data is encoded or not
        if (!fields || (fields && !fields.encoded)) {
          return callback(true)
        }

        try {
          var dec = AESCrypt.decrypt(fields.encoded)
          fields = JSON.parse(dec)
        } catch (err) {
          return callback(true)
        }

        callback(err, fields, files)
      })
    })
  },

  upload: (options, callback) => {
    fse.mkdirs(path.dirname(options.dst), (err) => {
      if (err) {
        return callback(err)
      }
      gm(options.src)
        .resize(options.width || 240, options.height || 240)
        .noProfile()
        .write(options.dst, callback)
    })
  },

  remove: (options, callback) => {
    fse.remove(options.filepath, callback)
  }
}

module.exports = _self
