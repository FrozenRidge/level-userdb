var async = require('async')
var bcrypt = require('bcrypt')
var levelup = require('levelup')
var through = require('through')
var bytewise = require('bytewise')

var PREFIX = "user:"

// Turn an email into a key
function k(email) {
  return bytewise.encode([PREFIX, email]);
}

// Turn a key into an email
function dk(k) {
  return bytewise.decode(k)[1]
}

function genTimestamp(dt) {
  var d = dt || new Date()

  return {unixtime: d.getTime(), hrtime: process.hrtime()}
}

function encryptPassword(password, cb) {
  bcrypt.hash(password, 10, cb)
}

function buildUser(password, data, cb, insecure) {
  if (typeof cb === 'boolean') {
    insecure = cb
  }
  if (typeof data === 'function') {
    cb = data
    data = {}
  }
  // This is for benchmarking without bcrypt hit
  // DO NOT USE FOR ANY OTHER PURPOSE
  var f = encryptPassword
  if (insecure) {
    f = function(password, cb) {
      return cb(null, password)
    }
  }
  f(password, function(err, pass) {
    var d = new Date()
    var userObj = {
      password: pass,
      createdTimestamp: genTimestamp(),
      modifiedTimestamp: genTimestamp(),
      data:data
    }
    cb(null, userObj)
  })
}

// DB can be a string, undefined or an existing LevelUP-compatible object
module.exports = function(db) {
  var name = "./level-userdb.db"
  if (typeof db === 'string') {
    name = db
  }
  if (!db || typeof db === 'string') {
    db = levelup(name, {
      keyEncoding: 'binary',
      valueEncoding: 'json'
    })
  }

  // Set up the write queue with concurrency of 1.
  // This serializes write-after-read operations.
  // We could make this more fine-grained by making per-account queues.
  var writeQ = async.queue(function(task, cb) {
    task(function() {
      cb()
    })
  }, 1)


  // Attach methods to LevelUp object

  db.findUser = (function (email, cb) {
    this.get(k(email), function(err, user) {
      if (err) return cb(err)
      user.modifiedDate = new Date(user.modifiedTimestamp.unixtime)
      user.createdDate = new Date(user.createdTimestamp.unixtime)
      user.email = email;

      return cb(null, user)
    })
  }).bind(db)

  db.addUser = (function(email, password, data, cb, insecure) {
    var self = this
    if (typeof data === 'function') {
      cb = data
      data = {}
    }
    var f = encryptPassword
    // This is for benchmarking without bcrypt hit
    // DO NOT USE FOR ANY OTHER PURPOSE
    if (insecure) {
      f = function(password, cb) {
        return cb(null, password)
      }
    }
    f(password, function(err, pass) {
      var d = new Date()
      var userObj = {
        password: pass,
        createdTimestamp: genTimestamp(d),
        modifiedTimestamp: genTimestamp(d),
        data:data
      }
      self.put(k(email), userObj, cb)
    })
  }).bind(db)

  db.checkPassword = (function(email, password, cb) {
    this.findUser(email, function(err, user) {
      if (err || !user) return cb("could not find user", false)
        bcrypt.compare(password.toString(), user.password.toString(), function(err, res) {
          if (err || !res) return cb("password mismatch", false)
          cb(null, user)
        })
    })
  }).bind(db)

  db.changeEmail = (function(email, newEmail, cb) {
    var self = this
    writeQ.push(function(done) {
      self.findUser(email, function(err, user) {
        if (err) {
          done()
          return cb(err)
        }
        user.modifiedTimestamp = genTimestamp()
        self.batch()
          .del(k(email))
          // it's strange that we have to specify the valueEnconding here again
          .put(k(newEmail), user, {valueEncoding: "json"})
          .write(function(err) {
            done()
            cb(err)
          })
      })
    })
  }).bind(db)

  db.changePassword = (function(email, newPassword, cb, insecure) {
    var self = this
    writeQ.push(function(done) {
      buildUser(newPassword, function(err, userObj) {
        if (err) {
          done()
          return cb(err)
        }
        self.findUser(email, function(err, user) {
          if (err) {
            done()
            return cb(err)
          }
          userObj.modifiedTimestamp = genTimestamp()
          userObj.data = user.data;
          self.put(k(email), userObj, function(err) {
            done()
            cb(err)
          })
        })
      }, insecure)
    })
  }).bind(db)

  db.deleteUser = (function(email, cb) {
    this.del(k(email), cb)
  }).bind(db)

  db.modifyUser = (function(email, data, cb) {
    var self = this
    writeQ.push(function(done) {
      self.findUser(email, function(err, user) {
        if (err) {
          done()
          return cb(err)
        }
        user.data = data
        user.modifiedTimestamp = genTimestamp()
        self.put(k(email), user, function(err) {
          done()
          cb(err)
        })
      })
    })
  }).bind(db)

  db.createUserStream = (function(opts) {
    return this.createReadStream(opts).pipe(through(function write(data) {
      var u = data.value
      u.modifiedDate = new Date(u.modifiedTimestamp.unixtime)
      u.createdDate = new Date(u.createdTimestamp.unixtime)
      u.email = dk(data.key);
      this.queue(u)
    }))
  }).bind(db)

  return db
}
