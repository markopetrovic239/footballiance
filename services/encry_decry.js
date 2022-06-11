import crypto from 'crypto'

var algorithm = 'aes192',
    password = 'erqAFxxCshjKla';

var _self = {
    encrypt: function encrypt(text) {
        var cipher = crypto.createCipher(algorithm, password);
        var crypted = cipher.update(text, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    },

    decrypt: function decrypt(text) {
        var decipher = crypto.createDecipher(algorithm, password);
        var dec = decipher.update(text, 'hex', 'utf8');
        dec += decipher.final('utf8');
        return dec;
    }
};

module.exports = _self;
