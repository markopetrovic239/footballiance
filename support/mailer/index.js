import nodemailer from 'nodemailer'
import smtpTransport from 'nodemailer-smtp-transport'
const config = rootRequire('config')
const transport = nodemailer.createTransport((smtpTransport(config.mailOptions)))

var _self = {

  mail_header: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' +
    '<html xmlns="http://www.w3.org/1999/xhtml">' +
    '<head>' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>' +
    '</head>' +
    '<body>' +
    '<center><img src="' + config.appHost + '/uploads/logo/logo.jpg" style="height:50px;width:50px;"></center></br>' +
    '<div style="min-height: 20px;"> </div>',

  mail_footer: '<div style="min-height: 20px;"></div><center>Copyright &copy; 2017 xCode. All rights reserved.</center></body></html>',

  mail: (options, callback) => {
    if (!options || !options.to || !options.from || !options.subject || !options.html) {
      return callback('Invalid parametes', null)
    }

    var mailOptions = {
      to: options.to,
      from: options.from, // From   : xCode Team<xcode@agileinfoways.com>
      subject: options.subject, // Subject  : Email verification
      html: _self.mail_header + options.html + _self.mail_footer // Body    : HTML content/Plain text
    }

    if (typeof callback === 'function')
      transport.sendMail(mailOptions, callback)
    else
      transport.sendMail(mailOptions)
  }
}

module.exports = _self
