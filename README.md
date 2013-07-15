# level-userdb

[![Build Status](https://travis-ci.org/FrozenRidge/level-userdb.png)](https://travis-ci.org/FrozenRidge/level-userdb)

LevelDB-backed user database for Node.js. This does standard web/mobile app account storage:

- Users are stored by email address
- Passwords are hashed with bcrypt
- Created and modified timestamps
- Store arbitrary JSON metadata along with each account
- Compatible with [multilevel](https://github.com/juliangruber/multilevel) for network access
- Multi-step write-after-read operations (such as changeEmail, changePassword and modifyUser) are run serially to avoid race conditions.

Tools & libraries:

- CLI admin tool (local and network): [level-userdb-cli](https://github.com/FrozenRidge/level-userdb-cli)
- Standalone network server: [level-userdb-server](https://github.com/FrozenRidge/level-userdb-server)
- PassportJS helpers: [level-userdb-passport](https://github.com/FrozenRidge/level-userdb-passport)
- Benchmark / stress test: [level-userdb-bench](https://github.com/FrozenRidge/level-userdb-bench)


## Installation

`npm install level-userdb`

## Quickstart

```javascript

var db = require('level-userdb')()

// Adding a user
db.addUser('foobar@example.com', 'supersecret',
  {some:{nested:"metadata", associatedWithUser:true}, foo:[1,2,3]},
  function(err) {
    if (err) return console.log("error adding user: %s", err)
    console.log("ok")
  }
)

// Checking a password for an account
db.checkPassword('foobar@example.com', 'supersecret', function(err, user) {
  if (err) return console.log("invalid password: %s", err)
  console.log("password ok")
})


```

#### CLI tool

`npm install -g level-userdb-cli`

Learn more about the CLI tool: [level-userdb-cli](https://github.com/FrozenRidge/level-userdb-cli)

## Tests

Test suite can be run via `npm test`. It requires Chai and Mocha.

## Benchmark / Performance / Stress-test

[level-userdb-bench](https://github.com/FrozenRidge/level-userdb-bench) is an attempt at a somewhat-useful benchmark or stress test. It
attempts to create a mixed, concurrent workload of reads and writes. Feel free
to look at the code and poke holes in how it is written. I don't claim it is a
perfect or even especially-meaningful performance test. Note that it disables
`bcrypt` on passwords for all writes.

Here are some results from a 2013 11" MBA (SSD, 1.7Ghz Haswell i7) on OS X 10.8.4:

```
Starting benchmark with concurrency level 20
reads: 3262.1/s changePasswords: 3312.4/s inserts: 3291.7/s modifies: 3292.2/s total ops: 13158.4/s errs: 0/s
reads: 3179.3/s changePasswords: 3161.2/s inserts: 3220.9/s modifies: 3193.1/s total ops: 12754.5/s errs: 0/s
reads: 3067.3/s changePasswords: 3092.8/s inserts: 3079.2/s modifies: 3079/s total ops: 12318.3/s errs: 0/s
reads: 2918.1/s changePasswords: 2923.6/s inserts: 2949.7/s modifies: 2960/s total ops: 11751.4/s errs: 0/s
reads: 2880/s changePasswords: 2897.7/s inserts: 2873.6/s modifies: 2879.4/s total ops: 11530.7/s errs: 0/s
reads: 2758.7/s changePasswords: 2797.4/s inserts: 2777.3/s modifies: 2785.2/s total ops: 11118.6/s errs: 0/s
reads: 2688.6/s changePasswords: 2711/s inserts: 2693/s modifies: 2685.3/s total ops: 10777.9/s errs: 0/s
reads: 2586/s changePasswords: 2586.6/s inserts: 2586.4/s modifies: 2615.4/s total ops: 10374.4/s errs: 0/s
benchmark completed
total reads 249005 changePasswords: 250234 inserts: 250197 modifies: 250564 ops: 1000000 errs: 0

```


## Database

level-userdb uses [LevelUP](https://github.com/rvagg/node-levelup) as a database for users. The current schema is very simple:
Users are keyed by email address and converted to a JavaScript array with first item "user:". Key encoding is set to [Bytewise](https://github.com/deanlandolt/bytewise). Value encoding is set to JSON, in other words values are transparently marshalled to/from native JavaScript objects by LevelUP itself.

User values are JSON objects with the properties:

- `email`: Email address of user account
- `password`: Hashed password string (bcrypt)
- `createdTimestamp`: User creation timestamp. This has properties:
   - `unixtime`: milliseconds since Jan 1st 1970. Used for creating JavaScript Date objects.
   - `hrtime`: high-resolution time data from `process.hrtime()`. This can be used to avoid race conditions as
   `unixtime` is not high-resoltion enough.
- `createdDate`: User created timestamp. JavaScript Date() object already marshalled for convenience.
- `modifiedTimestamp`: User last modified timestamp. This has properties:
   - `unixtime`: milliseconds since Jan 1st 1970. Used for creating JavaScript Date objects.
   - `hrtime`: high-resolution time data from `process.hrtime()`. This can be used to avoid race conditions as
   `unixtime` is not high-resoltion enough.
- `modifiedDate`: User last modified timestamp. JavaScript Date() object already marshalled for convenience.
- `data`: Property under which arbitrary JSON data can be stored


### Database API

Require the `level-userdb` module and instantiate:

```javascript

var db = require('level-userdb')('./mydatabase')
```

#### LevelUP plugins

You can also pass an existing LevelUP compatible object. This enables you to take advantage of the
[many LevelUP plugins and modules](https://github.com/rvagg/node-levelup/wiki/Modules).

For example [level-userdb-server](https://github.com/FrozenRidge/level-userdb-server)
takes advantage of this to make `level-userdb` accessible over the network with [multilevel](https://github.com/juliangruber/multilevel).

```javascript
var db = require('level-userdb')(myLevelUpDB)

```

The `db` object has the following methods:

#### findUser

`findUser(email, cb)`

Returns the user object if found, 

CB should be a signature of form:

`function(err, user)`

If account is not found, `err` is set and user is `undefined`.

#### addUser

`addUser(email, password, data, cb)`

Adds a new user to the database. Passwords are hashed with bcrypt.

`data` is an optional parameter for non-indexed data. It defaults to an empty object (`{}`).

#### checkPassword

`checkPassword(email, password, cb)`

Checks whether the supplied password is correct for the given account. Only bcrypt passwords are stored in the database.

CB should be a signature of form:

`function(err, user)`

If account is found and the password is a match, user parameter will contain user object. Otherwise, err will be set and user parameter will be false.

#### changeEmail

`changeEmail(email, newEmail, cb)`

Update the email address on an account.

#### deleteUser

`deleteUser(email, cb)`

Delete a user object by email address.

#### modifyUser

`modifyUser(email, data, cb)`

Update the `data` property for the given email address.

#### createUserStream

`createUserStream(opts)`

Returns an object stream of users. This accepts the same options object as LevelUP's `createReadStream()` so can be used
for range queries etc.
