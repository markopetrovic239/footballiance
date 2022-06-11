import {
  createLogger,
  format,
  transports
} from 'winston'
const {
  combine,
  timestamp,
  label,
  printf,
  colorize
} = format

const myFormat = printf(info => {
  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
})

const logger = createLogger({
  format: combine(
    label({ label: 'x-code' }),
    timestamp(),
    colorize(),
    myFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: './logs/combined.log'
    })
  ],
  exceptionHandlers: [
    new transports.Console(),
    new transports.File({
      filename: './logs/exceptions.log'
    })
  ],
  exitOnError: false
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(new transports.Console({
//     format: format.simple()
//   }))
// }

export default logger
