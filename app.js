import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import expressValidator from 'express-validator'
import initAPISVersions from './api'
import staticRoutes from './routes'
import swaggerUi from 'swagger-ui-express'

const swaggerDocument = require('./swagger.json')
const app = express()

global.rootRequire = (name) => {
  return require(`${__dirname}/${name}`)
}
global.rootPath = __dirname

// view engine setup
app.engine('html', require('ejs').renderFile)
app.set('view engine', 'html')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(expressValidator({
  customValidators: {
    gte: (param, num) => {
      return param >= num
    }
  }
}))

app.use(cookieParser())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5,  Date, X-Api-Version, X-File-Name')
  res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')
  next()
})

// swagger APIs doc
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// socket webview api initialize
app.use('/socket', staticRoutes)

// initilize API versions
initAPISVersions(app, '')

// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// development error handler - will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler - no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

// handle all exceptions
// process.on('uncaughtException', function (err) {
//   console.log('Uncaught Exception: '+err)
// })

module.exports = app
