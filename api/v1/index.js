module.exports = (app, apiBase) => {
  require('./socketRoutes/').init(app, apiBase) // socket APIs

  app.use(apiBase, require('./routes/auth'))
}
