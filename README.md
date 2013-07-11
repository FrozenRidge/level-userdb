level-userdb
============

[![Build Status](https://travis-ci.org/FrozenRidge/level-userdb.png)](https://travis-ci.org/FrozenRidge/level-userdb)

LevelDB-backed user database for Node.js. This does standard web/mobile app accounts storage:

- users stored by email address
- passwords are encrypted with bcrypt
- created and modified timestamps
- store arbitrary json metadata along with each account

Tools:

- CLI admin tool: [level-userdb-cli](https://github.com/FrozenRidge/level-userdb-cli)
- Dnode network interface: [level-userdb-dnode](https://github.com/FrozenRidge/level-userdb-dnode)
- PassportJS helpers: [level-userdb-passport](https://github.com/FrozenRidge/level-userdb-passport)


## Installation

`npm install level-userdb`

## Adding a user

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

// Checking a password for login
db.checkPassword('foobar@example.com', 'supersecret', function(err, user) {
  if (err) return console.log("invalid password: %s", err)
  console.log("password ok")
})


```

#### CLI tool

`npm install -g level-userdb-cli`

Learn more about CLI tool: [level-userdb-cli](https://github.com/FrozenRidge/level-userdb-cli)

## Tests

Test suite can be run via `npm test`. It requires Chai and Mocha.

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

Require the `db` module and instantiate:

```javascript

var db = require('level-userdb')('./mydatabase')
```

The `db` object has the following methods:

#### findUser

`findUser(email, cb)`

Returns the user object if found, throws an exception if not.

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

#### printAllUsers

`printAllUsers()`

Print all the users in the database along with their created and last modified timestamps.

