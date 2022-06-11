import async from 'async'
import dbConn from '../db/connection'
import ED from '../../../services/encry_decry'

var _self = {
    adLogin: (req, res) => {
        async.waterfall([
            (nextCall) => {
                req.checkBody('email', "Email is required.").notEmpty();
                req.checkBody('email', "Invalid email").isEmail();
                req.checkBody('password', "Password is required.").notEmpty();
                let error = req.validationErrors();
                if (error && error.length) {
                    return nextCall({
                        "message": error[0].msg
                    })
                }
                nextCall(null, req.body)
            },
            (body, nextCall) => {
                let encPass = ED.encrypt(body.password);
                let getAdminQuery = "select * from tbl_admin where email=?";
                dbConn(getAdminQuery, [body.email], (error, admin) => {
                    if (error) {
                      /*return res.sendToEncode({
                         status: 200,
                        message: "Success",
                        data: response
                    });  */
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (admin.length) {
                        let adminData = admin[0];
                        if (adminData.password == ED.encrypt(body.password)) {
                            delete adminData.password;
                            nextCall(null, adminData);
                        } else {
                            return nextCall({ "message": "Incorrect password." });
                        }
                    } else {
                        return nextCall({ "message": "No admin found." });
                    }
                });
            }
        ], (err, response) => {
            if (err) {
                return res.sendToEncode({
                    status: 400,
                    message: (err && err.message) || "Oops! Something went wrong.",
                    data: {}
                })
            }
            return res.sendToEncode({
                status: 200,
                message: "Success",
                data: response
            })
        });
    }
};

module.exports = _self;
