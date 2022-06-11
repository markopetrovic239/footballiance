import async from 'async'
import dbConn from '../db/connection'
import CT from 'crontab'
import https from 'https'
import { isNumber } from 'lodash';
var parseString = require('xml2js').parseString;
import request from 'request'
import moment from 'moment'
import momentTZ from 'moment-timezone';

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
        dbConn(query, [body.camp_name, body.camp_desc, Number(body.author), body.feed_url, body.get_data_limit, (body.minute ? body.minute : null), (body.hour ? body.hour : null), (body.day ? body.day : null), (body.month ? body.month : null), (body.dow ? body.dow : null), (body.pre_sel_cron_tm ? body.pre_sel_cron_tm : null), body.category,body.is_partnered, body.id], (err, updateSucc) => {
          if (err) {
            console.log(err)
            return nextCall({
              "message": "Oops something went wrong !"
            });
          }  else {
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

  getFeed: (req, res) => {
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
    CT.load((err, crontab) => {
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
    CT.load((err, crontab) => {
      if (body.pre_sel_cron_tm) {
        crontab.create('wget http://35.237.202.229:3000/v1/auth/getFeed?id=' + id, body.pre_sel_cron_tm, 'comment_' + id);
      } else {
        let keyArr = ["minute", "hour", "month", "dow"];
        let job = crontab.create('wget http://35.237.202.229:3000/v1/auth/getFeed?id=' + id, 'comment_' + id);
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

   // console.log(formsData)
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

  addFeedDataIntoDB(result, formsData) {
    if (result && result.rss && result.rss.channel.length && result.rss.channel[0].item.length) {
      let feedData = result.rss.channel[0].item;
      console.log(feedData);
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
        let checkAlreadyAddedQuery = "SELECT count(`post_id`) as total FROM `wp_postmeta` WHERE `meta_key` LIKE 'article_reference_url' AND `meta_value` LIKE ?;"
        dbConn(checkAlreadyAddedQuery, [feedData[i].link[0]], (err, getData) => {
          if (err) {
            console.log('==========CHECK POST DATA=================');
            console.log("CHECK POST DATA ERROR");
            console.log('==========CHECK POST DATA=================');
          } else if (getData.length && getData[0].total <= 0) {
            dbConn(insertPostDataquery, [insertPostData], (err, insertSucc) => {
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
                dbConn(insertFeedURLANDImageQuery, [insertFeedURLData], (err, insertSucc) => {
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
                  "meta_value":formsData.is_partnered,
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
      }
    }
  }
}

module.exports = _self;
