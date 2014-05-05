var bcrypt = require('bcrypt')
, nodemailer = require("nodemailer")
, mandrillAuth
, users
, bots
, ObjectID = require('mongodb').ObjectID
, db;

/**
 * create the application routes
 */
module.exports.create = function(config) {
  db = config.db;
  mandrillAuth = config.mandrillAuth;
  users = config.users;
  bots = config.bots;
  return this;
}

/**********************
 ***** MIDDLEWARE *****
 **********************/

/**
 * check if user is authenticated
 */
module.exports.authMiddleware = function(req, res, next) {
  if(!req.session.username) {
    res.redirect('/');
  } else {
    next();
  }
};

/**
 * check if user is a guest
 */
module.exports.notGuestMiddleware = function(req, res, next) {
  if(!req.session.id) {
    res.redirect('/');
  } else {
    next();
  }
};

/******************
 ***** ROUTES *****
 ******************/

/**
 * get homepage
 */
module.exports.getHome = function(req, res) {
  if(req.session.username) {
    res.redirect('/play');
  } else {
    res.render('home');
  }
};

/**
 * sign in form data
 */
module.exports.postSignIn = function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  db.collection('users').findOne({'username': username}, function(err, doc) {
    if(!err && doc) {
      bcrypt.compare(password, doc.password, function(err, match) {
        if(match == true) {
          req.session.username = doc.username;
          req.session.id = doc._id;
          res.redirect('/play');
        } else {
          res.render('home', {
            'errors': {
              'msg': 'The username or password is not valid'
            },
            'values': req.body
          });
        }
      });
    } else {
      res.render('home', {
        'errors': {
          'msg' : 'The username or password is not valid'
        },
        'values': req.body
      });
    }
  });
};

/**
 * show sign up page
 */
module.exports.getSignUp = function(req, res) {
  if(req.session.username) {
    res.redirect('/play');
  } else {
    res.render('signup');
  }
};

/**
 * sign up user data
 */
module.exports.postSignUp = function(req, res) {
  var username = req.body.username;
  var email = req.body.email;
  var password = req.body.password;

  req.checkBody('username', 'Please use alphanumeric characters').isAlphanumeric();
  req.checkBody('email', 'Please enter a valid email address').isEmail();
  req.checkBody('password', 'Please enter a password').notEmpty();

  var errors = req.validationErrors(true);

  if(!errors) {
    db.collection('users').findOne({'username':username}, function(err, doc) {
      var isUsed = false;
      for(var i=0; i<bots.bots.length;i++) {
        if(bots.bots[i].name == username) {
          isUsed = true;
        }
      }
      if(username.match(/^guest\d*$/)) {
        isUsed = true;
      }
      if(!doc && !isUsed) {
        bcrypt.hash(password, 10, function(err, hash) {
          db.collection('users').insert({
            'username': username,
            'email': email,
            'password': hash
          }, function(err, docs) {
            if(!err) {
              req.session.id = docs[0]._id;
              req.session.username = docs[0].username;
              res.redirect('/play');
            }
          });
        });
      } else {
        errors = {
          'username': {
            'param': "username",
            'msg': "This username is already taken",
            'value': username
          }
        };
        res.render('signup', {'errors': errors, 'values': req.body });
      }
    });
  } else {
    res.render('signup', {'errors': errors, 'values': req.body });
  }
};

/**
 * sign in as guest user
 */
module.exports.getGuest = function(req, res) {
  var username = 'guest' + Math.floor(Math.random() * 9999 /*99999999*/);
  if(users[username]) {
    res.render('home', {'guestError': 'Too many guest users. Please try again later.'});
  } else {
    req.session.username = username;
    res.redirect('/play');
  }
};

/**
 * load game only if user has signed in
 */
module.exports.getPlay = function(req, res) {
  res.render('play', {
    'auth' : true,
    'id': req.session.id
  });
};

/**
 * show settings form
 */
module.exports.getSettings = function(req, res) {
  db.collection('users').findOne({'_id': ObjectID(req.session.id)}, function(err, doc) {
    if(!err && doc) {
      res.render('settings', {
        'values' : {
          'username': doc.username,
          'email' : doc.email
        },
        'auth' : true,
        'id': req.session.id
      });
   }
 });
};

/**
* update user settings
*/
module.exports.postSettings = function(req, res) {
  req.checkBody('email', 'Please enter a valid email address').isEmail();

  if(req.body.password) {
    var repeat = req.body.repeat;
    req.checkBody('password', 'Password and repeat password must match').equals(repeat);
  }

  var errors = req.validationErrors(true);

  if(errors) {
    res.render('settings', {
      'errors': errors,
      'values': req.body,
      'auth':true,
      'id': req.session.id
    });
  } else {
    var user = {
      'email' : req.body.email
    };

    if(req.body.password) {
      bcrypt.hash(req.body.password, 10, function(err, hash) {
        user.password = hash;
        db.collection('users').update({'_id': ObjectID(req.session.id)}, {$set: user}, function(err, docs) {
          res.redirect('/play');
        });
      });
    } else {
      db.collection('users').update({'_id': ObjectID(req.session.id)}, {$set: user}, function(err, docs) {
        res.redirect('/play');
      });
    }
  }
};

/**
 * destroy session and redirect to homepage
 */
module.exports.getSignOut = function(req, res) {
  req.session = null;
  res.redirect('/');
};

/**
 * show password recovery form
 */
module.exports.getRecovery = function(req, res) {
  res.render('recovery');
};

/**
 * create recovery token and send email link
 */
module.exports.postRecovery = function(req, res) {
  var email = req.body.email;
  db.collection('users').findOne({'email': email}, function(err, doc) {
    if(!err && doc) {
      var now = new Date();
      var token = Math.floor(Math.random() * 10) + parseInt(now.getTime()).toString(36);
      db.collection('users').update({'_id': doc._id}, {$set: {'token': token}}, function(err, docs) {
        if(err) throw err;
        var url = req.protocol + '://' + req.get('Host') + '/recovery/' + token;

          var smtpTransport = nodemailer.createTransport("SMTP",{
              service: "Mandrill",
              auth: mandrillAuth
          });

          var mailOptions = {
              from: mandrillAuth.user, // sender address
              to: doc.email, // list of receivers
              subject: "Password Recovery", // Subject line
              text: "Please follo this link to reset your password: \r\n \r\n" + url, // plaintext body
              html: "<p>Please follow this link to reset your password</p><p><a href=\""
              + url + "\">" + url + "</a></p>" // html body
          };

          smtpTransport.sendMail(mailOptions, function(error, response){
              if(error){
                  console.log(error);
              } else {
                  console.log("Message sent: " + response.message);
              }

              smtpTransport.close();
          });

        res.render('generic', {'message': 'We sent you an email to help you reset your password.'});
      });
    } else {
      res.render('recovery', { errors: { msg: 'This email does not exist'}, values: req.body});
    }
  });
};

/**
 * log in the user using the recovery token
 */
module.exports.getRecoverySignIn = function(req, res) {
  var token = req.params.token;
  db.collection('users').findOne({'token':token}, function(err, doc) {
    if(!err && doc) {
      req.session.username = doc.username;
      req.session.id = doc._id;
      db.collection('users').update({'_id': doc._id}, {$set: {'token': null}}, function(err, doc){
          res.redirect('/settings');
      });
    } else {
      res.render('generic', {'message': 'The token has already expired'});
    }
  });
};

/**
 * show rules page
 */
module.exports.getRules = function(req, res) {
 res.render('rules', {
   'auth': req.session.username,
   'id': req.session.id
 });
};
