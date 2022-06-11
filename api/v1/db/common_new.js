import async from 'async'
import dbConn from '../db/connection'
import CT from 'crontab'
const { got } = require("fix-esm").require('got');
import momentTZ from 'moment-timezone';
const parseXML = require("fast-xml-parser").XMLParser;
const parserXML = new parseXML();
/*var DOMParser = require('xmldom').DOMParser;
var parseString = require('xml2js').parseString; 
import request from 'request'
*/
var { parser } = require('html-metadata-parser');
var PostMetaArray = [];
var feedHitCount
var prevPostLimit = '20000';
var _self = {

    test: (req, res) => {
        res.sendToEncode({
            status: 200,
            message: 'TEST MESSAGE',
            data: {
                message: 'test'
            }
        })
    },

    getCategory: (req, res) => {
        async.waterfall([
            (nextCall) => {
                let query = "SELECT t.*, tt.* FROM wp_terms AS t INNER JOIN wp_term_taxonomy AS tt ON t.term_id = tt.term_id WHERE tt.taxonomy IN ('category') ORDER BY t.name ASC";
                dbConn(query, [], (err, category) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (category.length) {
                        nextCall(null, { "allCategories": category });
                    } else {
                        nextCall(null, { "allCategories": [] });
                    }
                })
            }
        ], (err, response) => {
            if (err) {
                return res.sendToEncode({
                    status: 400,
                    message: (err && err.message) || "Oops! Something went wrong.",
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
    },

    getAuthor: (req, res) => {
        async.waterfall([
            (nextCall) => {
                let query = "select id,user_login from wp_users order by user_login";
                dbConn(query, [], (err, authors) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (authors.length) {
                        nextCall(null, { "authors": authors });
                    } else {
                        nextCall(null, { "authors": [] });
                    }
                })
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
    },

    getCRONformDetails: (req, res) => {
        async.waterfall([
            (nextCall) => {
                if (!req.query || !req.query.id) {
                    return nextCall({ message: "ID is required." })
                }
                nextCall(null, req.query)
            },
            (body, nextCall) => {
                let query = "select * from tbl_cron_forms where id=?"
                dbConn(query, [body.id], (err, formsData) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData && formsData.length) {
                        nextCall(null, formsData[0]);
                    } else {
                        return nextCall({ "message": "No data found." });
                    }
                });
            }
        ], (err, response) => {
            if (err) {
                return res.status(400).sendToEncode({
                    status: 400,
                    message: (err && err.message) || "Oops! Something went wrong.",
                    data: {}
                })
            }
            return res.status(200).sendToEncode({
                status: 200,
                message: "Success",
                data: response
            })
        });
    },

    addCronForm: (req, res) => {
        async.waterfall([
            (nextCall) => {

                req.checkBody('camp_name', "Campaign name is required").notEmpty()
                req.checkBody('camp_desc', "Campaign description is required").notEmpty()
                req.checkBody('feed_url', "Feed URL is required").notEmpty()
                req.checkBody('author', "Author is required").notEmpty()
                req.checkBody('get_data_limit', "Get data limit is required").notEmpty()
                req.checkBody('category', "Category is required").notEmpty()
                req.checkBody('is_partnered', "Partnereship type is required").notEmpty()
                let error = req.validationErrors()
                if (error && error.length) {
                    return nextCall({
                        message: error[0].msg
                    })
                } else {
                    nextCall(null, req.body)
                }
            },
            (body, nextCall) => {
                if (body.feed_url && typeof body.feed_url == 'string') {
                    body.feed_url = JSON.parse(body.feed_url)
                }
                if (body.category && typeof body.category == 'object') {
                    body.category = JSON.stringify(body.category)
                }
                async.mapSeries(body.feed_url, (feedUrl, nextObj) => {
                    let insertData = {
                        ...body,
                        "feed_url": feedUrl,
                        "minute": body.minute ? body.minute : null,
                        "hour": body.hour ? body.hour : null,
                        "day": body.day ? body.day : null,
                        "month": body.month ? body.month : null,
                        "dow": body.dow ? body.dow : null,
                        "lastrun_at": "",
                        "pre_sel_cron_tm": body.pre_sel_cron_tm ? body.pre_sel_cron_tm : null,
                    };
                    let query = "insert into `tbl_cron_forms` SET ?";

                    dbConn(query, [insertData], (err, insertSucc) => {
                        if (err) {
                            return nextObj({
                                "message": "Oops something went wrong !"
                            });
                        } else {
                            let lastInsertId = insertSucc.insertId;
                            _self.setCronJob(lastInsertId, body);
                            nextObj(null, null);
                        }
                    })
                }, (loopErr, loopSucc) => {
                    if (loopErr) {
                        return nextCall(loopErr);
                    }
                    nextCall(null, body);
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
    },

    resetAllCrons: (req, res) => {
        async.waterfall([
            (nextCall) => {
                let query = "select * from tbl_cron_forms";
                dbConn(query, [], (err, crons) => {
                    if (err) {
                        ////console.log(err)
                        return nextCall({ "message": "Oops! Something went wrong. db" });
                    } else if (crons.length) {
                        nextCall(null, { "allCrons": crons });
                    } else {
                        nextCall(null, { "allCrons": [] });
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

            let crons = response.allCrons;
            CT.load((err, crontab) => {
                if (err) {
                    //console.log('err - CRON error', err)
                    return callback(err);
                }
                async.forEachOf(crons, (feed, i, callbackfeedData) => {
                    //console.log("removing.. " + crons[i].id)



                    crontab.remove({ comment: "comment_" + crons[i].id });

                    //console.log("adding.. " + crons[i].id)


                    if (crons[i].pre_sel_cron_tm) {
                        crontab.create('wget -O /dev/null http://10.142.0.3:3000/v1/auth/setFeed?id=' + crons[i].id, crons[i].pre_sel_cron_tm, 'comment_' + crons[i].id);
                        //crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id); // Old
                    } else {
                        let keyArr = ["minute", "hour", "month", "dow"];
                        //let job = crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, 'comment_' + id); // Old 100.68.68.47
                        let job = crontab.create('wget -O /dev/null http://10.142.0.3:3000/v1/auth/setFeed?id=' + crons[i].id, 'comment_' + crons[i].id);
                        keyArr.map((key) => {
                            if (crons[key] && Number(crons[key]) > 0) {
                                job[key]().every(Number(crons[key]));
                            }
                        });
                    }

                }, (err) => {
                    if (err) {
                        //console.log(err);
                        return res.sendToEncode({
                            status: 400,
                            message: "failed",
                            data: 'crons'
                        })
                    } else {
                        //console.log('last Call')
                        return res.sendToEncode({
                            status: 200,
                            message: "Success",
                            data: 'crons reset'
                        })

                    }
                });
                crontab.save((err, succ) => {
                    if (err) {
                        //console.log(err);
                        return res.sendToEncode({
                            status: 400,
                            message: "failed",
                            data: 'crons'
                        })
                        //console.log(err);
                    } else {
                        return res.sendToEncode({
                            status: 200,
                            message: "Success",
                            data: 'crons'
                        })

                    }
                });
            });


        });
    },
    editCronForm: (req, res) => {
        async.waterfall([
            (nextCall) => {
                req.checkBody('id', "ID is required").notEmpty()
                req.checkBody('author', "Author is required").notEmpty()
                req.checkBody('camp_name', "Campaign name is required").notEmpty()
                req.checkBody('camp_desc', "Campaign description is required").notEmpty()
                req.checkBody('feed_url', "Feed URL is required").notEmpty()
                req.checkBody('get_data_limit', "Get data limit is required").notEmpty()
                req.checkBody('category', "Category is required").notEmpty()
                req.checkBody('is_partnered', "Partnereship type is required").notEmpty()
                let error = req.validationErrors()
                if (error && error.length) {
                    return nextCall({
                        message: error[0].msg
                    })
                } else {
                    nextCall(null, req.body)
                }
            },
            (body, nextCall) => {
                if (body.category && typeof body.category == 'object') {
                    body.category = JSON.stringify(body.category)
                }
                let query = "update tbl_cron_forms set camp_name=?,camp_desc=?,author=?,feed_url=?,get_data_limit=?,minute=?,hour=?,day=?,month=?,dow=?,pre_sel_cron_tm=?,category=?,is_partnered=? where id = ?";
                dbConn(query, [body.camp_name, body.camp_desc, Number(body.author), body.feed_url, body.get_data_limit, (body.minute ? body.minute : null), (body.hour ? body.hour : null), (body.day ? body.day : null), (body.month ? body.month : null), (body.dow ? body.dow : null), (body.pre_sel_cron_tm ? body.pre_sel_cron_tm : null), body.category, body.is_partnered, body.id], (err, updateSucc) => {
                    if (err) {
                        console.log(err)
                        return nextCall({
                            "message": "Oops something went wrong !"
                        });
                    } else {
                        _self.removeCronJob(body.id, (err, succ) => {
                            if (err) {
                                return nextCall({
                                    "message": "Oops something went wrong !"
                                });
                            } else {
                                _self.setCronJob(body.id, body);
                                nextCall(null, null);
                            }
                        });
                    }
                })
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
    },

    deleteCron: (req, res) => {
        async.waterfall([
            (nextCall) => {
                if (!req.query || !req.query.id) {
                    return nextCall({ message: "ID is required." })
                }
                nextCall(null, req.query)
            },
            (body, nextCall) => {
                let query = "DELETE FROM tbl_cron_forms WHERE id = ?"
                dbConn(query, [body.id], (err, succ) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else {
                        _self.removeCronJob(body.id, (removeErr, removeSucc) => {
                        });
                        nextCall(null, null);
                    }
                });
            }
        ], (err, response) => {
            if (err) {
                return res.status(400).sendToEncode({
                    status: 400,
                    message: (err && err.message) || "Oops! Something went wrong.",
                    data: {}
                })
            }
            return res.status(200).sendToEncode({
                status: 200,
                message: "CRON deleted successfully.",
                data: {}
            })
        });
    },


    listAllCron: (req, res) => {
        async.waterfall([
            (nextCall) => {
                let query = "select * from tbl_cron_forms";
                dbConn(query, [], (err, crons) => {
                    if (err) {
                        console.log(err)
                        return nextCall({ "message": "Oops! Something went wrong. db" });
                    } else if (crons.length) {
                        nextCall(null, { "allCrons": crons });
                    } else {
                        nextCall(null, { "allCrons": [] });
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
    },

    removeCronJob(id, callback) {
        //football-alliance
        //CT.load('football-alliance',(err, crontab) => {
        // CT.load((err, crontab) => {
        //CT.load('football-alliance', (err, crontab) => { // old 1 -
        CT.load((err, crontab) => {
            if (err) {
                //console.log('err - CRON error', err)
                return callback(err);
            }
            crontab.remove({ comment: "comment_" + id });
            crontab.save((err, succ) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, succ);
                }
            });
        });
    },

    setCronJob: (id, body) => {

        //CT.load('football-alliance',(err, crontab) => {
        //CT.load((err, crontab) => { // old
        //CT.load('football-alliance', (err, crontab) => { // old 1 -
        CT.load((err, crontab) => {
            if (body.pre_sel_cron_tm) {
                crontab.create('wget -O /dev/null http://10.142.0.3:3000/v1/auth/setFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id);
                //crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id); // Old
            } else {
                let keyArr = ["minute", "hour", "month", "dow"];
                //let job = crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, 'comment_' + id); // Old
                let job = crontab.create('wget -O /dev/null http://10.142.0.3:3000/v1/auth/setFeed?id=' + id, 'comment_' + id);
                keyArr.map((key) => {
                    if (body[key] && Number(body[key]) > 0) {
                        job[key]().every(Number(body[key]));
                    }
                });
            }

            crontab.save((err, crontab) => { });
        });
    },

    getThirdPartyFeedData: (formsData, callback) => {


        (async () => {
            try {
                const response = await got(formsData.feed_url);
                try {
                    let jObj = parserXML.parse(response.body);
                    //console.log(jObj)
                    callback(null, jObj);
                }
                catch (err) {
                    callback('Parse Error', 'Data Not Found');
                }
                //=> '<!doctype html> ...'
            } catch (error) {
                callback('404', 'Data Not Found');
                //=> 'Internal server error ...'
            }
        })();
        // //console.log(formsData)
        /* request(formsData.feed_url, { json: true, UserAgent: 'My User Agent' }, (err, res) => {
            if (err) {
                callback(err);
            } else {
               
                try {
                    let jObj = parserXML.parse(res.body);
                    console.log(jObj)
                    callback(null, jObj);
                }
                catch (err) {
                    callback('404', 'Data Not Found');
                }

            }
        }); */

        /*  parseString(res.body, function (err, result) {
                    callback(null, result);
                }); */
    },
    getMetaData: (link, callback) => {

        parser(link).then(result => {
            if (result && result.og && result.og.image) {
                callback(null, result.og.image.split('?')[0]);
            } else {
                callback(null, '');
            }
        }).catch(err => {
            //console.log(err);
            callback(err)
        });
    },



    addFeedDataIntoDB: async (result, formsData, addFeedDataCallback) => {
        /* if (result && result.rss && result.rss.channel) {
            console.log('true');
        } */

        if (result && result.rss && result.rss.channel && result.rss.channel.item && result.rss.channel.item[0] && result.rss.channel.item.length) {
            let feedData = result.rss.channel.item;
            console.log("addFeedDataIntoDB Start =======================================>", formsData.camp_name)


            async.forEachOf(feedData, (feed, i, callbackfeedData) => {

                ////console.log("---------------- callback", i)
                if (i < formsData.get_data_limit) {

                    // //console.log(meta);
                    let postDate = momentTZ.tz("US/Eastern").format("YYYY-MM-DD HH:mm:ss");
                    var dontPullBeforeDate = new Date(postDate);
                    dontPullBeforeDate.setDate(dontPullBeforeDate.getDate() - 2); // Dont pull articles more than 2 days old
                    let pubDate = postDate;
                    if (feedData[i].pubDate && feedData[i].pubDate.length) {
                        pubDate = new Date(feedData[i].pubDate);
                    } else if (feedData[i].published && feedData[i].published.length) {
                        pubDate = new Date(feedData[i].published);
                    }

                    if (feedData[i].title && feedData[i].title && (feedData[i].title.includes(`‘`) || feedData[i].title.includes(`’`))) {
                        feedData[i].title = feedData[i].title.split("’").join("'");
                        feedData[i].title = feedData[i].title.split("‘").join("'");
                    }

                    let insertPostData = {
                        "post_author": formsData.author,
                        "post_date": postDate,
                        "post_date_gmt": postDate,
                        "post_content": feedData[i].description ? feedData[i].description : "",
                        "post_content_filtered": "",
                        "post_title": feedData[i].title ? feedData[i].title : "",
                        "post_excerpt": "",
                        "post_status": "publish",
                        "post_type": "post",
                        "comment_status": "open",
                        "ping_status": "open",
                        "post_password": "",
                        "post_name": "",
                        "to_ping": "",
                        "pinged": "",
                        "post_modified": postDate,
                        "post_modified_gmt": postDate,
                        "post_parent": 0,
                        "menu_order": 0,
                        "post_mime_type": "",
                        "guid": ""
                    }
                    let insertPostDataquery = "insert into `wp_posts` SET ?";
                    //let checkAlreadyAddedQuery = "SELECT count(`post_id`) as total FROM `view_wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' AND `meta_value` LIKE ? ;"
                    //console.log('-- check Already Added Query 1', formsData.camp_name)
                    //Check Duplicate data in system by URL

                    let feedSite;
                    let formSite = formsData.feed_url.substr(
                        formsData.feed_url.lastIndexOf("//") + 2,
                        formsData.feed_url.lastIndexOf(".com") - 4
                    );

                    if (feedData[i].link) {
                        feedSite = feedData[i].link.substr(
                            feedData[i].link.lastIndexOf("//") + 2,
                            feedData[i].link.lastIndexOf(".com") - 4
                        );

                    }

                    if (!PostMetaArray.includes(feedData[i].link) && feedSite === formSite && pubDate > dontPullBeforeDate) {
                        PostMetaArray.push(feedData[i].link)

                        dbConn(insertPostDataquery, [insertPostData], async (err, insertSucc) => {
                            ////console.log('-- check Already Added Query 3 ', formsData.camp_name)
                            if (err) {
                                console.log('==========POST DATA=================');
                                console.log("INSERT POST DATA ERROR");
                                console.log('==========POST DATA=================');
                                callbackfeedData(null, "Data Not Found")
                            } else {
                                let lastInsertId = insertSucc.insertId;
                                let insertFeedURLData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "article_reference_url",
                                    "meta_value": feedData[i].link ? feedData[i].link : "",
                                }
                                let insertFeedURLANDImageQuery = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], async (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========FEED URL DATA=================');
                                        console.log("FEED URL ERROR");
                                        console.log('==========FEED URL DATA=================');
                                    } else {
                                        feedHitCount++;
                                    }
                                })
                                ////console.log('-- check Already Added Query 4 ', formsData.camp_name)
                                // let lastInsertId = insertSucc.insertId;
                                let insertIsPartneredData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "is_partnered",
                                    "meta_value": formsData.is_partnered,
                                }

                                let insertIsPartnered = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertIsPartnered, [insertIsPartneredData], (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========IsPartnered DATA=================');
                                        console.log("IsPartnered ERROR");
                                        console.log('==========IsPartnered DATA=================');
                                    }
                                })
                                ////console.log('-- check Already Added Query 5 ', formsData.camp_name)
                                if ((feedData[i]["media:thumbnail"] && feedData[i]["media:thumbnail"].length)) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": feedData[i]["media:thumbnail"][0]["$"]["url"].split('?')[0]
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            console.log('==========FEED IMAGE DATA=================');
                                            console.log("FEED IMAGE ERROR");
                                            console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })
                                } else if (feedData[i].enclosure && feedData[i].enclosure.length) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": feedData[i].enclosure[0].$.url.split('?')[0]
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            console.log('==========FEED IMAGE DATA=================');
                                            console.log("FEED IMAGE ERROR");
                                            console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })

                                } else if (!feedData[i]["media:thumbnail"]) {
                                    _self.getMetaData(feedData[i].link, (error, metaImage) => {

                                        if (metaImage) {
                                            let insertFeedImageData = {
                                                "post_id": lastInsertId,
                                                "meta_key": "article_featured_img",
                                                "meta_value": metaImage
                                            }
                                            dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                                if (err) {
                                                    console.log('==========FEED IMAGE DATA=================');
                                                    console.log("FEED IMAGE ERROR");
                                                    console.log('==========FEED IMAGE DATA=================');
                                                }
                                            })
                                        } else {
                                            let insertFeedImageData = {
                                                "post_id": lastInsertId,
                                                "meta_key": "article_featured_img",
                                                "meta_value": 'https://footballiance.com/wp-content/themes/footballalliance/images/placekeeper.jpg'
                                            }
                                            dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                                if (err) {
                                                    console.log('==========FEED IMAGE DATA=================');
                                                    console.log("FEED IMAGE ERROR");
                                                    console.log('==========FEED IMAGE DATA=================');
                                                }
                                            })
                                        }

                                    })
                                }
                                else {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": 'https://footballiance.com/wp-content/themes/footballalliance/images/placekeeper.jpg'
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            console.log('==========FEED IMAGE DATA=================');
                                            console.log("FEED IMAGE ERROR");
                                            console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })
                                }
                                if (formsData && formsData.category) {
                                    let categoryArr = formsData.category.split(",");
                                    if (categoryArr.length) {
                                        categoryArr.map((singleCat) => {
                                            let insertWpTermRelData = {
                                                "object_id": lastInsertId,
                                                "term_taxonomy_id": singleCat
                                            }
                                            let insertWpTermRelQuery = "INSERT INTO `wp_term_relationships` SET ?";
                                            dbConn(insertWpTermRelQuery, [insertWpTermRelData], (err, insertSucc) => {
                                                if (err) {
                                                    console.log('==========RELATION DATA=================');
                                                    console.log("INSERT RELATION DATA ERROR");
                                                    console.log('==========RELATION DATA=================');
                                                }
                                            })
                                        });
                                        let updateGuidQuery = "update wp_posts set guid = ? where id = ?";
                                        dbConn(updateGuidQuery, [('https://footballiance.com/?p=' + lastInsertId), lastInsertId], function (err, updatedusers) {
                                            if (err) {
                                                console.log('==========UPDATE GUID=================');
                                                console.log("UPDATE GUID ERROR");
                                                console.log('==========UPDATE GUID=================');
                                            }
                                        });
                                        ////console.log('-- check Already Added Query 6 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    } else {
                                        ////console.log('-- check Already Added Query 7 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }
                                } else {
                                    ////console.log('-- check Already Added Query 8 ', formsData.camp_name)
                                    callbackfeedData(null, null)
                                }
                            }
                        });
                    } else {
                        ////console.log("----------------In Array Data ")
                        callbackfeedData(null, "No new data")
                    }


                } else {
                    ////console.log("---------------- Else feedDataData callback last")
                    callbackfeedData(null, null)
                }
            }, (err) => {
                if (err) {
                    return console.log(err);
                } else {
                    console.log('last Call')
                    addFeedDataCallback(null, null);
                    return true

                }
            })
        }
        else if (result && result.feed && result.feed.entry && result.feed.entry.length) {
            let feedData = result.feed.entry;
            // //console.log("feed---title",feed.title[0])
            //     //console.log("feed---link",feed.id[0])
            //     //console.log("feed---content",feed.content[0]._)

            async.forEachOf(feedData, (feed, i, callbackfeedData) => {
                if (i < formsData.get_data_limit) {

                    let postImage;
                    let myRegex = /<img[^>]+src="(https:\/\/[^">]+)"/g;
                    if (feed.content) {
                        postImage = myRegex.exec(feed.content);
                        if (postImage)
                            postImage = postImage[1].split('?')[0]
                        else
                            postImage = ''
                    }

                    if (feedData.title && (feedData.title.includes(`‘`) || feedData.title.includes(`’`))) {
                        feedData.title = feedData.title.split("’").join("'");
                        feedData.title = feedData.title.split("‘").join("'");
                    }
                    let postDate = momentTZ.tz("US/Eastern").format("YYYY-MM-DD HH:mm:ss");
                    var dontPullBeforeDate = new Date(postDate);
                    dontPullBeforeDate.setDate(dontPullBeforeDate.getDate() - 5);
                    let pubDate = postDate;

                    if (feedData[i].pubDate && feedData[i].pubDate.length) {
                        pubDate = new Date(feedData[i].pubDate);
                    } else if (feedData[i].published && feedData[i].published.length) {
                        pubDate = new Date(feedData[i].published);
                    }

                    let insertPostData = {
                        "post_author": formsData.author,
                        "post_date": postDate,
                        "post_date_gmt": postDate,
                        "post_content": feed.content && feed.content.length ? feed.content : "",
                        "post_content_filtered": "",
                        "post_title": feed.title && feed.title.length ? feed.title : "",
                        "post_excerpt": "",
                        "post_status": "publish",
                        "post_type": "post",
                        "comment_status": "open",
                        "ping_status": "open",
                        "post_password": "",
                        "post_name": "",
                        "to_ping": "",
                        "pinged": "",
                        "post_modified": postDate,
                        "post_modified_gmt": postDate,
                        "post_parent": 0,
                        "menu_order": 0,
                        "post_mime_type": "",
                        "guid": ""
                    }
                    let insertPostDataquery = "insert into `wp_posts` SET ?";
                    //feed.id[0] feed ID array for link
                    if (!PostMetaArray.includes(feed.id) && pubDate > dontPullBeforeDate) {
                        PostMetaArray.push(feed.id)
                        dbConn(insertPostDataquery, [insertPostData], async (err, insertSucc) => {
                            ////console.log('-- check Already Added Query 3 ', formsData.camp_name)
                            if (err) {
                                //console.log('==========POST DATA=================');
                                //console.log("INSERT POST DATA ERROR");
                                //console.log(err);
                                //console.log('==========POST DATA=================');
                                callbackfeedData(null, null)
                            } else {
                                let lastInsertId = insertSucc.insertId;
                                let insertFeedURLData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "article_reference_url",
                                    "meta_value": feed.id.length ? feed.id : "",
                                }
                                let insertFeedURLANDImageQuery = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], async (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========FEED URL DATA=================');
                                        console.log("FEED URL ERROR");
                                        console.log('==========FEED URL DATA=================');
                                    } {
                                        feedHitCount++;
                                    }
                                })
                                let insertIsPartneredData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "is_partnered",
                                    "meta_value": formsData.is_partnered,
                                }

                                let insertIsPartnered = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertIsPartnered, [insertIsPartneredData], (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========IsPartnered DATA=================');
                                        console.log("IsPartnered ERROR");
                                        console.log('==========IsPartnered DATA=================');
                                    }
                                })
                                ////console.log('-- check Already Added Query 5 ', formsData.camp_name)
                                if (postImage) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": postImage
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            console.log('==========FEED IMAGE DATA=================');
                                            console.log("FEED IMAGE ERROR");
                                            console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })
                                } else if (feedData[i].enclosure && feedData[i].enclosure.length) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": feedData[i].enclosure[0].$.url.split('?')[0]
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            //console.log('==========FEED IMAGE DATA=================');
                                            //console.log("FEED IMAGE ERROR");
                                            //console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })

                                }
                                else {
                                    _self.getMetaData(feedData[i].id, (error, metaImage) => {

                                        if (metaImage) {
                                            let insertFeedImageData = {
                                                "post_id": lastInsertId,
                                                "meta_key": "article_featured_img",
                                                "meta_value": metaImage
                                            }
                                            dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                                if (err) {
                                                    //console.log('==========FEED IMAGE DATA=================');
                                                    //console.log("FEED IMAGE ERROR");
                                                    //console.log('==========FEED IMAGE DATA=================');
                                                }
                                            })
                                        } else {
                                            let insertFeedImageData = {
                                                "post_id": lastInsertId,
                                                "meta_key": "article_featured_img",
                                                "meta_value": 'https://footballiance.com/wp-content/themes/footballalliance/images/placekeeper.jpg'
                                            }
                                            dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                                if (err) {
                                                    //console.log('==========FEED IMAGE DATA=================');
                                                    //console.log("FEED IMAGE ERROR");
                                                    //console.log('==========FEED IMAGE DATA=================');
                                                }
                                            })
                                        }

                                    })
                                }
                                if (formsData && formsData.category) {
                                    let categoryArr = formsData.category.split(",");
                                    if (categoryArr.length) {
                                        categoryArr.map((singleCat) => {
                                            let insertWpTermRelData = {
                                                "object_id": lastInsertId,
                                                "term_taxonomy_id": singleCat
                                            }
                                            let insertWpTermRelQuery = "INSERT INTO `wp_term_relationships` SET ?";
                                            dbConn(insertWpTermRelQuery, [insertWpTermRelData], (err, insertSucc) => {
                                                if (err) {
                                                    console.log('==========RELATION DATA=================');
                                                    console.log("INSERT RELATION DATA ERROR");
                                                    console.log('==========RELATION DATA=================');
                                                }
                                            })
                                        });
                                        let updateGuidQuery = "update wp_posts set guid = ? where id = ?";
                                        dbConn(updateGuidQuery, [('https://footballiance.com/?p=' + lastInsertId), lastInsertId], function (err, updatedusers) {
                                            if (err) {
                                                console.log('==========UPDATE GUID=================');
                                                console.log("UPDATE GUID ERROR");
                                                console.log('==========UPDATE GUID=================');
                                            }
                                        });
                                        ////console.log('-- check Already Added Query 6 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    } else {
                                        ////console.log('-- check Already Added Query 7 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }
                                } else {
                                    ////console.log('-- check Already Added Query 8 ', formsData.camp_name)
                                    callbackfeedData(null, null)
                                }
                            }
                        });
                    } else {
                        ////console.log("----------------In Array Data ")
                        callbackfeedData(null, "No new posts")
                    }

                } else {
                    ////console.log("---------------- Else feedDataData callback last")
                    callbackfeedData(null, null)
                }
            }, (err) => {
                if (err) {
                    return //console.log(err);
                } else {
                    //console.log('last Call')
                    addFeedDataCallback(null, null);
                    return true

                }
            })
        }
        else {

            //console.log("---------------- Not in loop")
            addFeedDataCallback(null, "Data Not Found")
        }

    },

    setFeed: (req, res) => {
        async.waterfall([
            (nextCall) => {

                if (req.query && req.query.id) {
                    let insertCronFormId = {
                        "cron_form_id": req.query.id
                    }
                    let insertCronFormIdQuery = "insert into `tbl_cron_ids` SET ?"
                    dbConn(insertCronFormIdQuery, [insertCronFormId], (err, insertSucc) => {
                        if (err) {
                            return nextCall({ "message": "Oops! Something went wrong." });
                        } else {
                            nextCall(null, null)
                        }
                    })
                } else {
                    return nextCall({ "message": "Missing Paramater." });
                }
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
    },



    getFeed: (req, res) => {
        async.waterfall([
            async (nextCall) => {
                let getIdsquery = "select * from tbl_cron_ids"

                dbConn(getIdsquery, (err, formsData) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData && formsData.length) {
                        let lastId = formsData[formsData.length - 1].id;
                        let tmpVar = formsData;
                        let deleteCronFormIdsQuery = "DELETE FROM tbl_cron_ids WHERE id <= ?"
                        dbConn(deleteCronFormIdsQuery, [lastId], (deleteErr, deleteSucc) => { });
                        if (tmpVar.length) {
                            //Create View for wp_postmeta
                            // let drop_view_wp_postmeta = "DROP VIEW IF EXISTS view_wp_postmeta;";
                            // dbConn(drop_view_wp_postmeta, [], async(err, formsData) => { });

                            // let view_wp_postmeta = "CREATE VIEW view_wp_postmeta AS SELECT post_id, meta_key, meta_value, meta_id  FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' order by meta_id desc limit 200; ";
                            // dbConn(view_wp_postmeta, [], async(err, formsData) => { });
                            let Getpostmata = "SELECT  `meta_value` FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' ORDER BY meta_id DESC limit " + prevPostLimit + ";";

                            dbConn(Getpostmata, [], (err, results) => {
                                if (err) {
                                    console.log("Error------------", err)
                                } else {
                                    let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                    PostMetaArray = [];
                                    PostMetaloop.forEach((postdata) => {
                                        //Create array for check data in cron
                                        PostMetaArray.push(postdata.meta_value)
                                    })
                                }
                            });

                            async.mapSeries(tmpVar, async (ids, nextObj) => {
                                ////console.log("--------------===============>Start")

                                console.log('1 Get Feed Map getFeed tbl cron----------', ids.cron_form_id)
                                setTimeout(() => {
                                    let query = "select * from tbl_cron_forms where id=?"
                                    dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                        ////console.log('2 Get Feed Map Serise Select Query formsData.length ----------', formsData.length)
                                        if (formsData && formsData.length) {
                                            ////console.log('3 Get Feed Map Serise If  formsData.length ----------', formsData.length)
                                            _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                if (result) {
                                                    //  _self.getMetaData(result, formsData[0], async (error, meta) => {
                                                    //  //console.log(meta);

                                                    feedHitCount = 0;
                                                    _self.addFeedDataIntoDB(result, formsData[0], async (error, result) => {
                                                        ////console.log('4 Get Feed Map Serise getThirdPartyFeedData ----------', formsData.length)
                                                        if (!error) {
                                                            let options = {
                                                                timeZone: 'America/New_York',
                                                                year: 'numeric',
                                                                month: 'numeric',
                                                                day: 'numeric',
                                                                hour: 'numeric',
                                                                minute: 'numeric',
                                                                second: 'numeric',
                                                            }


                                                            var datetime = (new Date()).toLocaleString([], options);


                                                            let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";

                                                            /*  + ": " + feedHitCount + " hits" */
                                                            var timestamp = datetime;
                                                            dbConn(query, [timestamp, formsData[0].id], (err, insertSucc) => {
                                                                if (insertSucc) {
                                                                    nextObj(null, null);
                                                                } else {
                                                                    return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                }
                                                            })
                                                        } else {
                                                            let options = {
                                                                timeZone: 'America/New_York',
                                                                year: 'numeric',
                                                                month: 'numeric',
                                                                day: 'numeric',
                                                                hour: 'numeric',
                                                                minute: 'numeric',
                                                                second: 'numeric',
                                                            }


                                                            var datetime = (new Date()).toLocaleString([], options);


                                                            let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";


                                                            var timestamp = datetime + " Fail getFeed Error";

                                                            dbConn(query, [timestamp, formsData[0].id], (err, insertSucc) => {
                                                                if (insertSucc) {
                                                                    nextObj(null, null);
                                                                } else {
                                                                    return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                }
                                                            })
                                                        }
                                                    });
                                                    //  });
                                                } else {
                                                    ////console.log('4 Get Feed Map Serise getThirdPartyFeedData Else ----------', formsData.length)
                                                    nextObj(null, null);
                                                }
                                            });
                                        } else {
                                            ////console.log('3 Get Feed Map Serise If  formsData.length Else----------', formsData.length)

                                            nextObj(null, null);
                                        }
                                    })
                                }, 6000);
                            }, (loopErr, loopSucc) => {
                                ////console.log("--------------===============>loopErr")
                                nextCall(null, null);
                            });
                        }
                    } else {

                        /*  let options = {
                             timeZone: 'America/New_York',
                             year: 'numeric',
                             month: 'numeric',
                             day: 'numeric',
                             hour: 'numeric',
                             minute: 'numeric',
                             second: 'numeric',
                         }
 
 
                         var datetime = (new Date()).toLocaleString([], options);
 
 
                         let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";
 
 
                         var timestamp = datetime + " Fail Form Data Not Found";
                         dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                             if (insertSucc) {
                                 return nextCall({ "message": "No form data found." });
                             } else {
                                 return nextCall({ "message": "Couldn't insert Timestamp" });
                             }
                         }) */
                        return nextCall({ "message": "No form data found." });

                    }
                })
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
    },


    getFeedNewAdmin: (req, res) => {
        async.waterfall([
            async (nextCall) => {
                let getIdsquery = "select * from tbl_cron_ids"

                dbConn(getIdsquery, (err, formsData) => {
                    if (err) {
                        /*   let options = {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              second: 'numeric',
                          }
  
  
                          var datetime = (new Date()).toLocaleString([], options);
  
  
                          let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";
  
  
                          var timestamp = datetime + " Fail";
                          dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                              if (insertSucc) {
                                  return nextCall({ "message": "Oops! Something went wrong." });
                              } else {
                                  return nextCall({ "message": "Couldn't insert Timestamp" });
                              }
                          }) */

                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData && formsData.length) {
                        let lastId = formsData[formsData.length - 1].id;
                        let tmpVar = formsData;
                        let deleteCronFormIdsQuery = "DELETE FROM tbl_cron_ids WHERE id <= ?"
                        dbConn(deleteCronFormIdsQuery, [lastId], (deleteErr, deleteSucc) => { });
                        if (tmpVar.length) {
                            let Getpostmata = "SELECT  `meta_value` FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' ORDER BY meta_id DESC LIMIT " + prevPostLimit + ";";

                            dbConn(Getpostmata, [], (err, results) => {
                                if (err) {
                                    console.log("Error------------", err)
                                } else {
                                    let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                    PostMetaArray = [];
                                    PostMetaloop.forEach((postdata) => {
                                        //Create array for check data in cron
                                        PostMetaArray.push(postdata.meta_value)
                                    })
                                }
                            });


                            async.mapSeries(tmpVar, async (ids, nextObj) => {

                                console.log('1 Get Feed Map tbl cron----------', ids.cron_form_id)
                                setTimeout(() => {
                                    let query = "select * from tbl_cron_forms where id=?"
                                    dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                        if (formsData && formsData.length) {
                                            _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                if (result) {
                                                    //     _self.getMetaData(result, formsData[0], async (error, meta) => {
                                                    // //console.log(meta);
                                                    //nextObj(null, null);
                                                    feedHitCount = 0;

                                                    _self.addFeedDataIntoDB(result, formsData[0], async (error, result) => {
                                                        if (!error) {
                                                            let options = {
                                                                timeZone: 'America/New_York',
                                                                year: 'numeric',
                                                                month: 'numeric',
                                                                day: 'numeric',
                                                                hour: 'numeric',
                                                                minute: 'numeric',
                                                                second: 'numeric',
                                                            }


                                                            var datetime = (new Date()).toLocaleString([], options);

                                                            let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";

                                                            /*  + ": " + feedHitCount + " hits" */
                                                            var timestamp = datetime;

                                                            dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                                                                if (insertSucc) {
                                                                    nextObj(null, null);
                                                                } else {
                                                                    return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                }
                                                            })


                                                        } else {
                                                            let options = {
                                                                timeZone: 'America/New_York',
                                                                year: 'numeric',
                                                                month: 'numeric',
                                                                day: 'numeric',
                                                                hour: 'numeric',
                                                                minute: 'numeric',
                                                                second: 'numeric',
                                                            }


                                                            var datetime = (new Date()).toLocaleString([], options);


                                                            let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";


                                                            var timestamp = datetime + " Fail getFeed Error";
                                                            dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                                                                if (insertSucc) {
                                                                    nextObj(null, null);
                                                                } else {
                                                                    return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                }
                                                            })
                                                        }
                                                    });
                                                    //});
                                                } else {
                                                    nextObj(null, null);
                                                }
                                            });
                                        } else {
                                            nextObj(null, null);
                                        }
                                    })
                                }, 6000);
                            }, (loopErr, loopSucc) => {
                                nextCall(null, null);
                            });
                        }
                    } else {
                        if (req.query && req.query.id) {

                            let insertCronFormId = {
                                "cron_form_id": req.query.id
                            }
                            let insertCronFormIdQuery = "insert into `tbl_cron_ids` SET ?"
                            dbConn(insertCronFormIdQuery, [insertCronFormId], (err, insertSucc) => {
                                if (err) {
                                    return nextCall({ "message": "Oops! Something went wrong." });
                                } else {
                                    //nextCall(null, null)
                                    let getIdsquery = "select * from tbl_cron_ids"

                                    dbConn(getIdsquery, (err, formsData) => {
                                        if (err) {
                                            return nextCall({ "message": "Oops! Something went wrong." });
                                        } else if (formsData && formsData.length) {
                                            let lastId = formsData[formsData.length - 1].id;
                                            let tmpVar = formsData;
                                            let deleteCronFormIdsQuery = "DELETE FROM tbl_cron_ids WHERE id <= ?"
                                            dbConn(deleteCronFormIdsQuery, [lastId], (deleteErr, deleteSucc) => { });
                                            if (tmpVar.length) {
                                                let Getpostmata = "SELECT  `meta_value` FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' ORDER BY meta_id DESC limit " + prevPostLimit + ";";

                                                dbConn(Getpostmata, [], (err, results) => {
                                                    if (err) {
                                                        console.log("Error------------", err)
                                                    } else {
                                                        let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                                        PostMetaArray = [];
                                                        PostMetaloop.forEach((postdata) => {
                                                            //Create array for check data in cron
                                                            PostMetaArray.push(postdata.meta_value)
                                                        })
                                                    }
                                                });

                                                async.mapSeries(tmpVar, async (ids, nextObj) => {
                                                    ////console.log("--------------===============>Start")
                                                    console.log('1 Get Feed Map req.query----------', ids.cron_form_id)
                                                    setTimeout(() => {
                                                        let query = "select * from tbl_cron_forms where id=?"
                                                        dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                                            ////console.log('2 Get Feed Map Serise Select Query formsData.length ----------', formsData.length)
                                                            if (formsData && formsData.length) {

                                                                ////console.log('3 Get Feed Map Serise If  formsData.length ----------', formsData.length)
                                                                _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                                    if (result) {
                                                                        //_self.getMetaData(result, formsData[0], async (error, meta) => {
                                                                        //  //console.log(meta);
                                                                        // nextObj(null, null);
                                                                        feedHitCount = 0;
                                                                        let errorOnReq = error;
                                                                        _self.addFeedDataIntoDB(result, formsData[0], async (errorMsg, result) => {
                                                                            ////console.log('4 Get Feed Map Serise getThirdPartyFeedData ----------', formsData.length)

                                                                            if (!errorMsg && result !== 'Data Not Found') {
                                                                                let options = {
                                                                                    timeZone: 'America/New_York',
                                                                                    year: 'numeric',
                                                                                    month: 'numeric',
                                                                                    day: 'numeric',
                                                                                    hour: 'numeric',
                                                                                    minute: 'numeric',
                                                                                    second: 'numeric',
                                                                                }


                                                                                var datetime = (new Date()).toLocaleString([], options);



                                                                                let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";

                                                                                /*  + ": " + feedHitCount + " hits" */
                                                                                var timestamp = datetime;

                                                                                dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                                                                                    if (insertSucc) {
                                                                                        nextObj(null, null);
                                                                                    } else {
                                                                                        return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                                    }
                                                                                })


                                                                            } else {

                                                                                let errMsg = ' Error';

                                                                                if (!errorMsg && !errorOnReq) {
                                                                                    errMsg = " Error pulling data";
                                                                                } else if (errorOnReq === '404') {
                                                                                    errMsg = ' Error requesting site'
                                                                                }
                                                                                let options = {
                                                                                    timeZone: 'America/New_York',
                                                                                    year: 'numeric',
                                                                                    month: 'numeric',
                                                                                    day: 'numeric',
                                                                                    hour: 'numeric',
                                                                                    minute: 'numeric',
                                                                                    second: 'numeric',
                                                                                }


                                                                                var datetime = (new Date()).toLocaleString([], options);


                                                                                let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";


                                                                                var timestamp = datetime + errMsg;
                                                                                dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                                                                                    if (insertSucc) {
                                                                                        nextObj(null, null);
                                                                                    } else {
                                                                                        return nextCall({ "message": "Couldn't insert Timestamp" });
                                                                                    }
                                                                                })
                                                                            }



                                                                        });
                                                                        //   });
                                                                    } else {
                                                                        ////console.log('4 Get Feed Map Serise getThirdPartyFeedData Else ----------', formsData.length)
                                                                        nextObj(null, null);
                                                                    }
                                                                });
                                                            } else {
                                                                ////console.log('3 Get Feed Map Serise If  formsData.length Else----------', formsData.length)
                                                                nextObj(null, null);
                                                            }
                                                        })
                                                    }, 6000);
                                                }, (loopErr, loopSucc) => {

                                                    ////console.log("--------------===============>loopErr")
                                                    nextCall(null, null);
                                                });
                                            }
                                        } else {
                                            /*  let options = {
                                                 timeZone: 'America/New_York',
                                                 year: 'numeric',
                                                 month: 'numeric',
                                                 day: 'numeric',
                                                 hour: 'numeric',
                                                 minute: 'numeric',
                                                 second: 'numeric',
                                             }
 
 
                                             var datetime = (new Date()).toLocaleString([], options);
 
 
                                             let query = "update tbl_cron_forms set lastrun_at = ? where id = ?";
 
 
                                             var timestamp = datetime + " Fail Form Data Not Found";
                                             dbConn(query, [timestamp, ids.cron_form_id], (err, insertSucc) => {
                                                 if (insertSucc) {
                                                     return nextCall({ "message": "No form data found." });
                                                 } else {
                                                     return nextCall({ "message": "Couldn't insert Timestamp" });
                                                 }
                                             }) */

                                            return nextCall({ "message": "No form data found." });
                                        }
                                    })
                                }
                            })
                        } else {
                            return nextCall({ "message": "Missing Paramater." });
                        }
                    }
                })
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
    },
}

module.exports = _self;
