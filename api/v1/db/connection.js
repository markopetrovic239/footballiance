import mongoose from 'mongoose'
import mysql from 'mysql2'
const config = rootRequire('config')
let connection

// DB configuration
if (config.database.use === 'mongodb') {
  connection = mongoose.createConnection(config.database.mongoURL + 'doctor_app') // database name
  connection.on('error', (err) => console.error(err))
} else if (config.database.use === 'mysql') {
  var pool = mysql.createPool(config.database.mySQLConfig)
  console.log('Successfully connected with mysql')

  connection = (sqlQuery, params, callback) => {
    // get a connection from a pool request
    pool.getConnection((err, conn) => {
      if (err) {
        console.log("err:::::::::; ",err)
        return callback(true)
      }
      // execute a query
      conn.query(sqlQuery, params, (err, results) => {
        conn.release()
        if (err) {
          console.log("err :  ",err)
          callback(true)
          return
        }
        callback(false, results)
      })
    })
  }
} else {
  console.error('Failed to connect with db')
}

module.exports = connection
