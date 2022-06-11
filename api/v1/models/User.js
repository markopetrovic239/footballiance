import mongoose from 'mongoose'
import moment from '../../../utils/moment'

const Schema = mongoose.Schema
const connection = require('../db/connection')
const ED = rootRequire('utils/encry_decry')

var schema = new Schema({
  user_email: {
    type: String,
    required: true
  },
  user_pass: {
    type: String,
    required: true
  },
  display_name: {
    type: String,
    default: ''
  }
}, {
  collection: 'wp_users'
})

module.exports = connection.model(schema.options.collection, schema)
