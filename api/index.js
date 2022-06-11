/**
 * Initilize all api verions according to application release
 **/
module.exports = (app, apiBase) => {
  require('./v1')(app, `${apiBase}/v1`)
}
