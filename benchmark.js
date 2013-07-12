var async = require('async')
var db = require('./db')

var CONCURRENCY = 10
// 100000 accounts
var RECORDS = 100000

var baseEmail = 'test@example.com'
var password = 'supersecret'

// Counters
var inserts = 0
var changePasswords = 0
var modifies = 0
var reads = 0

var ops = 0
var errs = 0

var dbi = db()

function randValidEmail() {
    var r = Math.floor(Math.random()*(RECORDS-0+1)+0);
    return r + '-' + baseEmail
}

var funcs = [

  // Find a random user. (no lock)
  function(done) {
    var email = randValidEmail()
    dbi.findUser(email, function(err) { if (err) errs++; reads++; ops++; done() })
  },

  // Modify a user's data. (goes through lock)
  function(done) {
    var email = randValidEmail()
    dbi.modifyUser(email, {some:"data", foobar:ops}, function(err) { if (typeof err !== 'object') errs++; modifies++; ops++; done()})
  },

  // Change password of existing user (goes through lock)
  function(done) {
    var email = randValidEmail()
    dbi.changePassword(email, "password"+ops, function(err) { if (typeof err !== 'object') errs++; changePasswords++; ops++; done()}, true)
  },

  // Insert a new user (no lock)
  function(done) {
    var email = RECORDS + inserts + '-' + baseEmail
    dbi.addUser(email, "password"+ops, {data:ops}, function(err) { if (err) errs++; inserts++; ops++; done()}, true)
  },
]


// Populate the database with X accounts
function populate(x, done) {
  var i = 0
  async.whilst(
    function() { return i < x },
    function(cb) {
      dbi.addUser(i + '-' + baseEmail,
        password, {some:"data", field:i}, cb, true)
      i++
      if (i % 1000 === 0) {
        console.log("%s records written", i)
      }
    },
    done)
}

console.log("populating db with %d accounts", RECORDS)
var t1 = process.hrtime()
populate(RECORDS, function(err) {
  var diff = process.hrtime(t1)
  console.log("populated with %d records in %d nanoseconds", RECORDS, diff[0] * 1e9 + diff[1])
  console.log("[%d addUser()s / second]", RECORDS / diff[0])
  startBench()
})

function startBench() {

  console.log("Starting benchmark with concurrency level %d", CONCURRENCY)
  var q = async.queue(function(task, cb) {
    task(function() {
      cb()
    })
  }, CONCURRENCY)

  var OPS = 1000000
  // 10 seconds
  var SAMPLE_RATE = 10
  var nops = ops
  var nchangePasswords = changePasswords
  var ninserts = inserts
  var nmodifies = modifies
  var nreads = reads
  var nerrs = errs
  var iv = setInterval(function() {
    var pops = ops - nops
    var pchangePasswords = changePasswords - nchangePasswords
    var pinserts = inserts - ninserts
    var pmodifies = modifies - nmodifies
    var preads = reads - nreads
    var perrs = errs - nerrs
    console.log("reads: %d/s changePasswords: %d/s inserts: %d/s modifies: %d/s total ops: %d/s errs: %d/s",
      preads / SAMPLE_RATE, pchangePasswords / SAMPLE_RATE, pinserts / SAMPLE_RATE, pmodifies / SAMPLE_RATE, pops / SAMPLE_RATE, perrs / SAMPLE_RATE)
    nops = ops
    nchangePasswords = changePasswords
    ninserts = inserts
    nmodifies = modifies
    nreads = reads
    nerrs = errs
    t = new Date().getTime()
  },  SAMPLE_RATE * 1000)

  async.whilst(
    function() { return ops < OPS },
    function(cb) {
      q.push(function(done) {
        var idx = Math.floor(Math.random() * 4) + 0
        funcs[idx](done)
        cb(null)
      })
    },
    function() {
      console.log("benchmark completed")
      console.log("total reads %d changePasswords: %d inserts: %d modifies: %d ops: %d errs: %d", reads, changePasswords, inserts, modifies, ops, errs)
      process.exit(0)
    })
}
