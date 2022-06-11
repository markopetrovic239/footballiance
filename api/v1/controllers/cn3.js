import async from 'async'
import dbConn from '../db/connection'
import CT from 'crontab'
import https from 'https'
import { isNumber } from 'lodash';

var DOMParser = require('xmldom').DOMParser;
var parseString = require('xml2js').parseString;
import request from 'request'
import moment from 'moment'
import momentTZ from 'moment-timezone';
var { parser } = require('html-metadata-parser');
var PostMetaArray = [];
var prevPostLimit = '10000';
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
                    } else if (formsData.length) {
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
                        "pre_sel_cron_tm": body.pre_sel_cron_tm ? body.pre_sel_cron_tm : null,
                    };
                    console.log(insertData)
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

    getFeedBKP: (req, res) => {
        async.waterfall([
            (nextCall) => {
                if (req.query && req.query.id) {
                    let query = "select * from tbl_cron_forms where id=?"
                    dbConn(query, [req.query.id], (err, formsData) => {
                        if (err) {
                            return nextCall({ "message": "Oops! Something went wrong." });
                        } else if (formsData.length) {
                            _self.getThirdPartyFeedData(formsData[0], (error, result) => {
                                if (error) {
                                    console.log(err)
                                    return nextCall({ "message": "Data not found from this URL " + formsData.feed_url });
                                } else {
                                    _self.addFeedDataIntoDB(result, formsData[0]);
                                    // nextCall(null, null);
                                    nextCall(null, result.rss.channel[0].item);
                                }
                            });
                        } else {
                            return nextCall({ "message": "No form data found." });
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
                console.log('err - CRON error', err)
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
                crontab.create('wget -O /dev/null http://34.73.154.2:3000/v1/auth/setFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id);
                //crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id); // Old
            } else {
                let keyArr = ["minute", "hour", "month", "dow"];
                //let job = crontab.create('wget -O /dev/null http://35.237.202.229:3000/v1/auth/setFeed?id=' + id, 'comment_' + id); // Old
                let job = crontab.create('wget -O /dev/null http://34.73.154.2:3000/v1/auth/setFeed?id=' + id, 'comment_' + id);
                keyArr.map((key) => {
                    if (body[key] && Number(body[key]) > 0) {
                        job[key]().every(Number(body[key]));
                    }
                });
            }

            crontab.save((err, crontab) => { });
        });
    },

/*     getThirdPartyFeedData: (formsData, callback) => {

        // console.log(formsData)
        request(formsData.feed_url, { json: true }, (err, res) => {
            if (err) {
                callback(err);
            } else {
              var xmlStringSerialized = new DOMParser().parseFromString(res.body, "text/xml");

                parseString(xmlStringSerialized, function (err, result) {
                  if (err) {
                    callback(err);
                }else{
                    callback(null, result);
                }
                });
            }
        });
    }, */
    getThirdPartyFeedData: (formsData, callback) => {

      request(formsData.feed_url, { json: true }, (err, res) => {
        if (err) {
            callback(err);
        } else {
            parseString(res.body, function (err, result) {
                callback(null, result);
            });
        }
    });
  },
    getMetaData: async (link,  callback) => {

      await parser(link).then(result=>{
        if(result.og.image){
        callback(null, result.og.image.replace('?w=1024&h=576&crop=1', ''));
        }else
         {
          callback(null, '');
          }
     }).catch(err=>{
       console.log(err);
       callback(err)
     });

  },

    async addFeedDataIntoDB_bkp(result, formsData) {
        if (result && result.rss && result.rss.channel.length && result.rss.channel[0].item.length) {
            let feedData = result.rss.channel[0].item;
            console.log("addFeedDataIntoDB Start =======================================>",formsData.camp_name)
            for (let i = 0; i < formsData.get_data_limit; i++) {
                // let postDate = moment().format("YYYY-MM-DD HH:mm:ss");
                let postDate = momentTZ.tz("US/Eastern").format("YYYY-MM-DD HH:mm:ss");
                let insertPostData = {
                    "post_author": formsData.author,
                    "post_date": postDate,
                    "post_date_gmt": postDate,
                    "post_content": feedData[i].description.length ? feedData[i].description[0] : "",
                    "post_content_filtered": "",
                    "post_title": feedData[i].title.length ? feedData[i].title[0] : "",
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
                //let checkAlreadyAddedQuery = "SELECT count(`post_id`) as total FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' AND `meta_value` LIKE ? order by meta_id desc limit 200;"
                let checkAlreadyAddedQuery = "SELECT count(`post_id`) as total FROM `view_wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' AND `meta_value` LIKE ? ;"
                console.log('------addFeedDataIntoDB checkAlreadyAddedQuery 1', formsData.camp_name)
                await dbConn(checkAlreadyAddedQuery, [feedData[i].link[0]], async(err, getData) => {
                    console.log('------addFeedDataIntoDB checkAlreadyAddedQuery 2 ', formsData.camp_name)
                    if (err) {
                        console.log('==========CHECK POST DATA=================');
                        console.log("CHECK POST DATA ERROR", err);
                        console.log('==========CHECK POST DATA=================');
                    } else if (getData.length && getData[0].total <= 0) {
                        await dbConn(insertPostDataquery, [insertPostData], async (err, insertSucc) => {
                            if (err) {
                                console.log('==========POST DATA=================');
                                console.log("INSERT POST DATA ERROR");
                                console.log('==========POST DATA=================');
                            } else {
                                let lastInsertId = insertSucc.insertId;
                                let insertFeedURLData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "article_reference_url",
                                    "meta_value": feedData[i].link.length ? feedData[i].link[0] : "",
                                }
                                let insertFeedURLANDImageQuery = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], async (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========FEED URL DATA=================');
                                        console.log("FEED URL ERROR");
                                        console.log('==========FEED URL DATA=================');
                                    }
                                })
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
                                if (feedData[i]["media:thumbnail"] && feedData[i]["media:thumbnail"].length) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": feedData[i]["media:thumbnail"][0]["$"]["url"]
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
                                        dbConn(updateGuidQuery, [('https://fa-test.com/?p=' + lastInsertId), lastInsertId], function (err, updatedusers) {
                                            if (err) {
                                                console.log('==========UPDATE GUID=================');
                                                console.log("UPDATE GUID ERROR");
                                                console.log('==========UPDATE GUID=================');
                                            }
                                        });
                                    }
                                }
                            }
                        })
                    }
                })
                console.log('------addFeedDataIntoDB checkAlreadyAddedQuery 3 ', formsData.camp_name)
            }
            console.log("addFeedDataIntoDB End =======================================>",formsData.camp_name)
        }
    },

   /*  let metaScrape = function(data){
      return parser( feedData[i].link[0]).then((result)=>
    {
     return result.images[0].src;
    }
   ).catch(err =>{
                  console.log(err);
                });
              } */
    //async addFeedDataIntoDB(result, formsData, addFeedDataCallback) {


    addFeedDataIntoDB: async (result, formsData, addFeedDataCallback)  => {
        // console.log("-------------------");
        // console.log(result);
        // console.log("-------------------");

        if (result && result.rss && result.rss.channel.length && result.rss.channel[0].item.length) {
            let feedData = result.rss.channel[0].item;
            console.log("addFeedDataIntoDB Start =======================================>",formsData.camp_name)
/*
            let resultMeta;
            async.forEachOf(feedData, (feed, i, callbackfeedData) => {
            (async () => {
                if(feedData[i].link[0]){
                    if(feedData[i].link[0].includes('pff')){
                        resultMeta =  parse(feedData[i].link[0]);
                       console.log(resultMeta);
                    } else if(feedData[i].link[0].includes('profootballnetwork')){
                       let metaResult = parser( feedData[i].link[0]).then((result)=>
                             {
                              return result.og.image;

                             }
                            ).catch(err =>{
                                           console.log(err);
                                         });

                        metaResult.then((result)=>{
                         //metaImage = result;
                       });
                    }
                      console.log(resultMeta);
                }
              })();
            }) */

            async.forEachOf(feedData, (feed, i, callbackfeedData) => {

                //console.log("---------------- callback", i)
                if(i < formsData.get_data_limit){

                  _self.getMetaData(feedData[i].link[0],  (error, metaImage) => {
                   // console.log(meta);
                    let postDate = momentTZ.tz("US/Eastern").format("YYYY-MM-DD HH:mm:ss");
                    let insertPostData = {
                        "post_author": formsData.author,
                        "post_date": postDate,
                        "post_date_gmt": postDate,
                        "post_content": feedData[i].description && feedData[i].description.length ? feedData[i].description[0] : "",
                        "post_content_filtered": "",
                        "post_title": feedData[i].title && feedData[i].title.length ? feedData[i].title[0] : "",
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

                    if(feedData[i].link[0]){
                      feedSite =  feedData[i].link[0].substr(
                        feedData[i].link[0].lastIndexOf("//") + 2,
                        feedData[i].link[0].lastIndexOf(".com") - 4
                    );

                    }

                    if(!PostMetaArray.includes(feedData[i].link[0]) && feedSite === formSite){
                        PostMetaArray.push(feedData[i].link[0])
                        dbConn(insertPostDataquery, [insertPostData], async (err, insertSucc) => {
                            //console.log('-- check Already Added Query 3 ', formsData.camp_name)
                            if (err) {
                                console.log('==========POST DATA=================');
                                console.log("INSERT POST DATA ERROR");
                                console.log('==========POST DATA=================');
                                callbackfeedData(null, null)
                            } else {
                                let lastInsertId = insertSucc.insertId;
                                let insertFeedURLData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "article_reference_url",
                                    "meta_value": feedData[i].link.length ? feedData[i].link[0] : "",
                                }
                                let insertFeedURLANDImageQuery = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], async (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========FEED URL DATA=================');
                                        console.log("FEED URL ERROR");
                                        console.log('==========FEED URL DATA=================');
                                    }
                                })
                                //console.log('-- check Already Added Query 4 ', formsData.camp_name)
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
                                //console.log('-- check Already Added Query 5 ', formsData.camp_name)
                                if (metaImage ||( feedData[i]["media:thumbnail"] && feedData[i]["media:thumbnail"].length)) {
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": metaImage ? metaImage : feedData[i]["media:thumbnail"][0]["$"]["url"]
                                    }
                                    dbConn(insertFeedURLANDImageQuery, [insertFeedImageData], (err, insertSucc) => {
                                        if (err) {
                                            console.log('==========FEED IMAGE DATA=================');
                                            console.log("FEED IMAGE ERROR");
                                            console.log('==========FEED IMAGE DATA=================');
                                        }
                                    })
                                }else if(metaImage){
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
                                }
                                else{
                                    let insertFeedImageData = {
                                        "post_id": lastInsertId,
                                        "meta_key": "article_featured_img",
                                        "meta_value": 'https://fa-test.com/wp-content/themes/footballalliance/images/placekeeper.jpg'
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
                                        dbConn(updateGuidQuery, [('https://fa-test.com/?p=' + lastInsertId), lastInsertId], function (err, updatedusers) {
                                            if (err) {
                                                console.log('==========UPDATE GUID=================');
                                                console.log("UPDATE GUID ERROR");
                                                console.log('==========UPDATE GUID=================');
                                            }
                                        });
                                        //console.log('-- check Already Added Query 6 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }else{
                                        //console.log('-- check Already Added Query 7 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }
                                }else{
                                    //console.log('-- check Already Added Query 8 ', formsData.camp_name)
                                    callbackfeedData(null, null)
                                }
                            }
                        });
                    }else{
                        //console.log("----------------In Array Data ")
                        callbackfeedData(null, null)
                    }


                  })
                }else{
                    //console.log("---------------- Else feedDataData callback last")
                    callbackfeedData(null, null)
                }
            }, (err) => {
                if (err) {
                    return console.log(err);
                }else{
                    console.log('last Call')
                    addFeedDataCallback(null,null);
                    return true

                }
            })
        }
        else if (result && result.feed && result.feed.entry.length) {
            let feedData = result.feed.entry;
            // console.log("feed---title",feed.title[0])
            //     console.log("feed---link",feed.id[0])
            //     console.log("feed---content",feed.content[0]._)

            async.forEachOf(feedData, (feed, i, callbackfeedData) => {
                if(i < formsData.get_data_limit){
                  _self.getMetaData(feed.id[0],  (error, metaImage) => {
                    if(error){
                      console.log('last Call' + error.message);
                    addFeedDataCallback(null,null);
                    }
                    let postImage = metaImage
                    let myRegex = /<img[^>]+src="(https:\/\/[^">]+)"/g;
                    if(feed.content[0]._){
                    postImage = myRegex.exec(feed.content[0]._);
                    postImage = postImage[1]
                  }

                    let postDate = momentTZ.tz("US/Eastern").format("YYYY-MM-DD HH:mm:ss");
                    let insertPostData = {
                        "post_author": formsData.author,
                        "post_date": postDate,
                        "post_date_gmt": postDate,
                        "post_content": feed.content && feed.content.length && feed.content[0]._ ? feed.content[0]._ : feed.content ? feed.content[0] : "",
                        "post_content_filtered": "",
                        "post_title": feed.title && feed.title.length ? feed.title[0] : "",
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
                    if(!PostMetaArray.includes(feed.id[0])){
                        PostMetaArray.push(feed.id[0])
                        dbConn(insertPostDataquery, [insertPostData], async (err, insertSucc) => {
                            //console.log('-- check Already Added Query 3 ', formsData.camp_name)
                            if (err) {
                                console.log('==========POST DATA=================');
                                console.log("INSERT POST DATA ERROR");
                                console.log('==========POST DATA=================');
                                callbackfeedData(null, null)
                            } else {
                                let lastInsertId = insertSucc.insertId;
                                let insertFeedURLData = {
                                    "post_id": lastInsertId,
                                    "meta_key": "article_reference_url",
                                    "meta_value": feed.id.length ? feed.id[0] : "",
                                }
                                let insertFeedURLANDImageQuery = "INSERT INTO `wp_postmeta` SET ?";
                                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], async (err, insertSucc) => {
                                    if (err) {
                                        console.log('==========FEED URL DATA=================');
                                        console.log("FEED URL ERROR");
                                        console.log('==========FEED URL DATA=================');
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
                                //console.log('-- check Already Added Query 5 ', formsData.camp_name)
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
                                        dbConn(updateGuidQuery, [('https://fa-test.com/?p=' + lastInsertId), lastInsertId], function (err, updatedusers) {
                                            if (err) {
                                                console.log('==========UPDATE GUID=================');
                                                console.log("UPDATE GUID ERROR");
                                                console.log('==========UPDATE GUID=================');
                                            }
                                        });
                                        //console.log('-- check Already Added Query 6 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }else{
                                        //console.log('-- check Already Added Query 7 ', formsData.camp_name)
                                        callbackfeedData(null, null)
                                    }
                                }else{
                                    //console.log('-- check Already Added Query 8 ', formsData.camp_name)
                                    callbackfeedData(null, null)
                                }
                            }
                        });
                    }else{
                        //console.log("----------------In Array Data ")
                        callbackfeedData(null, null)
                    }
                  })
                }else{
                    //console.log("---------------- Else feedDataData callback last")
                    callbackfeedData(null, null)
                }
            }, (err) => {
                if (err) {
                    return console.log(err);
                }else{
                    console.log('last Call')
                    addFeedDataCallback(null,null);
                    return true

                }
            })
        }
        else{

            console.log("---------------- Not in loop")
            addFeedDataCallback(null, null)
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

    getFeed_bkp: (req, res) => {
        async.waterfall([
            async (nextCall) => {

                let getIdsquery = "select * from tbl_cron_ids"
                dbConn(getIdsquery, (err, formsData) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData.length) {
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
                            async.mapSeries(tmpVar, async (ids, nextObj) => {
                                console.log("--------------===============>Start")
                                console.log('1 Get Feed Map Serise----------', ids.cron_form_id)
                                setTimeout(() => {
                                    let query = "select * from tbl_cron_forms where id=?"
                                    dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                        console.log('2 Get Feed Map Serise Select Query formsData.length ----------', formsData.length)
                                        if (formsData.length) {
                                            console.log('3 Get Feed Map Serise If  formsData.length ----------', formsData.length)
                                            _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                if (result) {
                                                    await _self.addFeedDataIntoDB(result, formsData[0]);
                                                    console.log('4 Get Feed Map Serise getThirdPartyFeedData ----------', formsData.length)
                                                }
                                            });
                                        }
                                    })
                                    console.log("--------------===============>EnD")
                                    nextObj(null, null);
                                }, 6000);
                            }, (loopErr, loopSucc) => {
                                nextCall(null, null);
                            });
                        }
                    } else {
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

    getFeed: (req, res) => {
        async.waterfall([
            async (nextCall) => {
                let getIdsquery = "select * from tbl_cron_ids"

                dbConn(getIdsquery, (err, formsData) => {
                    if (err) {
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData.length) {
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
                                if(err){
                                    console.log("Error------------",err)
                                }else{
                                    let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                    PostMetaArray = [];
                                    PostMetaloop.forEach((postdata) => {
                                        //Create array for check data in cron
                                        PostMetaArray.push(postdata.meta_value)
                                    })
                                }
                            });

                            async.mapSeries(tmpVar, async (ids, nextObj) => {
                                //console.log("--------------===============>Start")
                                console.log('1 Get Feed Map Serise----------', ids.cron_form_id)
                                setTimeout(() => {
                                    let query = "select * from tbl_cron_forms where id=?"
                                    dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                        //console.log('2 Get Feed Map Serise Select Query formsData.length ----------', formsData.length)
                                        if (formsData.length) {
                                            //console.log('3 Get Feed Map Serise If  formsData.length ----------', formsData.length)
                                            _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                if (result) {
                                                //  _self.getMetaData(result, formsData[0], async (error, meta) => {
                                                  //  console.log(meta);


                                                    _self.addFeedDataIntoDB(result, formsData[0], async (error, result) => {
                                                        //console.log('4 Get Feed Map Serise getThirdPartyFeedData ----------', formsData.length)
                                                        nextObj(null, null);
                                                    });
                                                  //  });
                                                }else{
                                                    //console.log('4 Get Feed Map Serise getThirdPartyFeedData Else ----------', formsData.length)
                                                    nextObj(null, null);
                                                }
                                            });
                                        }else{
                                            //console.log('3 Get Feed Map Serise If  formsData.length Else----------', formsData.length)
                                            nextObj(null, null);
                                        }
                                    })
                                }, 6000);
                            }, (loopErr, loopSucc) => {
                                //console.log("--------------===============>loopErr")
                                nextCall(null, null);
                            });
                        }
                    } else {
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
                        return nextCall({ "message": "Oops! Something went wrong." });
                    } else if (formsData.length) {
                        let lastId = formsData[formsData.length - 1].id;
                        let tmpVar = formsData;
                        let deleteCronFormIdsQuery = "DELETE FROM tbl_cron_ids WHERE id <= ?"
                        dbConn(deleteCronFormIdsQuery, [lastId], (deleteErr, deleteSucc) => { });
                        if (tmpVar.length) {
                            let Getpostmata = "SELECT  `meta_value` FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' ORDER BY meta_id DESC limit " + prevPostLimit + ";";

                            dbConn(Getpostmata, [], (err, results) => {
                                if(err){
                                    console.log("Error------------",err)
                                }else{
                                    let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                    PostMetaArray = [];
                                    PostMetaloop.forEach((postdata) => {
                                        //Create array for check data in cron
                                        PostMetaArray.push(postdata.meta_value)
                                    })
                                }
                            });

                            async.mapSeries(tmpVar, async (ids, nextObj) => {
                                console.log('1 Get Feed Map Serise----------', ids.cron_form_id)
                                setTimeout(() => {
                                    let query = "select * from tbl_cron_forms where id=?"
                                    dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                        if (formsData.length) {
                                            _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                if (result) {
                                             //     _self.getMetaData(result, formsData[0], async (error, meta) => {
                                                   // console.log(meta);
                                                    //nextObj(null, null);

                                                    _self.addFeedDataIntoDB(result, formsData[0], async (error, result) => {
                                                        nextObj(null, null);
                                                    });
                                                  //});
                                                }else{
                                                    nextObj(null, null);
                                                }
                                            });
                                        }else{
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
                                        } else if (formsData.length) {
                                            let lastId = formsData[formsData.length - 1].id;
                                            let tmpVar = formsData;
                                            let deleteCronFormIdsQuery = "DELETE FROM tbl_cron_ids WHERE id <= ?"
                                            dbConn(deleteCronFormIdsQuery, [lastId], (deleteErr, deleteSucc) => { });
                                            if (tmpVar.length) {
                                                let Getpostmata = "SELECT  `meta_value` FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' ORDER BY meta_id DESC limit " + prevPostLimit + ";";

                                                dbConn(Getpostmata, [], (err, results) => {
                                                    if(err){
                                                        console.log("Error------------",err)
                                                    }else{
                                                        let PostMetaloop = Object.values(JSON.parse(JSON.stringify(results)));
                                                        PostMetaArray = [];
                                                        PostMetaloop.forEach((postdata) => {
                                                            //Create array for check data in cron
                                                            PostMetaArray.push(postdata.meta_value)
                                                        })
                                                    }
                                                });

                                                async.mapSeries(tmpVar, async (ids, nextObj) => {
                                                    //console.log("--------------===============>Start")
                                                    console.log('1 Get Feed Map Serise----------', ids.cron_form_id)
                                                    setTimeout(() => {
                                                        let query = "select * from tbl_cron_forms where id=?"
                                                        dbConn(query, [ids.cron_form_id], async (err, formsData) => {
                                                            //console.log('2 Get Feed Map Serise Select Query formsData.length ----------', formsData.length)
                                                            if (formsData.length) {
                                                                //console.log('3 Get Feed Map Serise If  formsData.length ----------', formsData.length)
                                                                _self.getThirdPartyFeedData(formsData[0], async (error, result) => {
                                                                    if (result) {
                                                                      //_self.getMetaData(result, formsData[0], async (error, meta) => {
                                                                      //  console.log(meta);
                                                                       // nextObj(null, null);

                                                                        _self.addFeedDataIntoDB(result, formsData[0], async (error, result) => {
                                                                            //console.log('4 Get Feed Map Serise getThirdPartyFeedData ----------', formsData.length)
                                                                            nextObj(null, null);
                                                                        });
                                                                    //   });
                                                                    }else{
                                                                        //console.log('4 Get Feed Map Serise getThirdPartyFeedData Else ----------', formsData.length)
                                                                        nextObj(null, null);
                                                                    }
                                                                });
                                                            }else{
                                                                //console.log('3 Get Feed Map Serise If  formsData.length Else----------', formsData.length)
                                                                nextObj(null, null);
                                                            }
                                                        })
                                                    }, 6000);
                                                }, (loopErr, loopSucc) => {
                                                    //console.log("--------------===============>loopErr")
                                                    nextCall(null, null);
                                                });
                                            }
                                        } else {
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
