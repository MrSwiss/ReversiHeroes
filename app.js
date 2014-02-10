/**
 * Multiplayer Reversi / Othello strategy board game.
 * Copyright (C) 2013 mnlg
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const SECRET = 'cookie-session-secret';

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server,{ log: false })
  , MongoClient = require('mongodb').MongoClient
  , ObjectID = require('mongodb').ObjectID
  , swig = require('swig')
  , cookie = require('express/node_modules/cookie')
  , connectUtils = require('express/node_modules/connect/lib/utils')
  , bcrypt = require('bcrypt')
  , expressValidator = require('express-validator')
  , nodemailer = require("nodemailer")
  , port = 8080
  , users = {}
  , games = {}
  , reversi = require('./reversi');

// Mandrill authentication
var mandrillAuth =  {
  user: "mantrill-user-name",
  pass: "mandrill-password"
};

// Middleware
app.use(express.static('public'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.cookieSession({ 'key': 'express.sid', 'secret' : SECRET }));
app.use(expressValidator());

/**
 * connect Mongo client
 */
MongoClient.connect('mongodb://localhost:27017/reversi', function(err, db) {

  if (err) throw err;

  /**
   * check if user is authenticated
   */
  var auth = function(req, res, next) {
    if(!req.session.username) {
      res.redirect('/');
    } else {
      next();
    }
  }

  /**
   * check if user is a guest
   */
  var notGuest = function(req, res, next) {
    if(!req.session.id) {
      res.redirect('/');
    } else {
      next();
    }
  }

  // set up the view engine
  app.engine('html', swig.renderFile);
  app.set('view engine', 'html');
  app.set('views', __dirname + '/views');
  swig.setDefaults({ cache: false });

  /**
   * get homepage
   */
  app.get('/', function(req, res) {
    if(req.session.username) {
      res.redirect('/play');
    } else {
      res.render('home');
    }
  });

  /**
   * sign in form data
   */
  app.post('/', function(req, res) {
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
  });

  /**
   * show sign up page
   */
  app.get('/signup', function(req, res) {
    if(req.session.username) {
      res.redirect('/play');
    } else {
      res.render('signup');
    }
  });

  /**
   * sign up user data
   */
  app.post('/signup', function(req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;

    req.checkBody('username', 'Please use alphanumeric characters').isAlphanumeric();
    req.checkBody('email', 'Please enter a valid email address').isEmail();
    req.checkBody('password', 'Please enter a password').notEmpty();

    var errors = req.validationErrors(true);

    if(!errors) {
      db.collection('users').findOne({'username':username}, function(err, doc) {
        if(!doc) {
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
  });

  /**
   * sign in as guest user
   */
  app.get('/guest', function(req, res) {
    var username = 'guest' + Math.floor(Math.random() * 9999 /*99999999*/);
    if(users[username]) {
      res.render('home', {'guestError': 'Too many guest users. Please try again later.'});
    } else {
      req.session.username = username;
      res.redirect('/play');
    }
  });

  /**
   * load game only if user has signed in
   */
  app.get('/play', auth, function(req, res) {
    res.render('play', {
      'auth' : true,
      'id': req.session.id
    });
  });

  /**
   * show settings form
   */
   app.get('/settings', auth, notGuest, function(req, res) {
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
   });

   /**
    * update user settings
    */
    app.post('/settings', auth, notGuest, function(req, res) {
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
    });

  /**
   * destroy session and redirect to homepage
   */
  app.get('/signout', function(req, res) {
    req.session = null;
    res.redirect('/');
  });

  /**
   * show password recovery form
   */
  app.get('/recovery', function(req, res) {
    res.render('recovery');
  });

  /**
   * create recovery token and send email link
   */
  app.post('/recovery', function(req, res) {
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
  });

  /**
   * log in the user using the recovery token
   */
  app.get('/recovery/:token', function(req, res) {
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
  });

  /**
   * show rules page
   */
   app.get('/rules', function(req, res) {
     res.render('rules', {
       'auth': req.session.username,
       'id': req.session.id
     });
   });

  /*************************
   ***** SOCKET EVENTS *****
   *************************/

   /**
    * check session cookie to authorize the socket and accept the connection
    */
   io.set('authorization', function (data, accept) {
     if (data.headers.cookie) {
       data.cookie = cookie.parse(data.headers.cookie, SECRET);
       data.cookie = connectUtils.parseSignedCookie(data.cookie['express.sid'], SECRET);
       data.cookie = connectUtils.parseJSONCookie(data.cookie);
       accept(null, true);
     } else {
        accept('No cookie transmitted.', false);
     }
   });

  /**
   * sockets connection
   */
  io.sockets.on('connection', function (socket) {
    socket.username = socket.handshake.cookie.username;
    socket.requests = [];
    socket.playing = false;

    // disconnect if this user is already connected
    if(users[socket.username]) {
      io.sockets.socket(users[socket.username].socket_id).disconnect();
    }

    users[socket.username] = {'socket_id' : socket.id};

    var init_users = {};

    for(user in users) {
      var u = {};
      u['playing'] = io.sockets.socket(users[user].socket_id).playing;
      u['username'] = user;
      init_users[user] = u;
    }

    socket.broadcast.emit('user connection', { user: socket.username });
    socket.emit('init', { username: socket.username, users: init_users });

    /**
     * sign in
     */
     socket.on('sigin', function(data) {
       socket.username = data.username;
       socket.broadcast.emit('user connection', { user: socket.username });
       socket.emit('init', { 'username': socket.username, 'users': init_users });
     });

    /**
     * chat
     */
    socket.on('chat', function(data) {
      socket.broadcast.emit('chat', {'message': data.message, 'username': socket.username });
    });

    /**
     * game chat
     */
    socket.on('game chat', function(data) {
      if(socket.playing && data.message) {
        socket.broadcast.to('game/' + socket.playing)
        . emit('game chat', {
          'message': data.message,
          'username': socket.username
        });
      }
    });

    /**
     * game end
     */
    socket.on('game end', function(data) {
      if(socket.playing) {
        socket.broadcast.to('game/' + socket.playing).emit('game leave', { 'username': socket.username });
        socket.leave('game/' + socket.playing);
        socket.playing = false;
        delete games[socket.playing];
        socket.broadcast.emit('game end', { 'username' : socket.username });
      }
    });

    /**
     * user forces the game to end
     */
    socket.on('game force end', function(data) {
      if(socket.playing) {
        socket.broadcast.to('game/' + socket.playing).emit('game force end', { 'username': socket.username });
        delete games[socket.playing];
      }
    });

    /**
     * game move
     */
    socket.on('game move', function(data) {
      var game = games[socket.playing];
      if(socket.playing && game && data.coords.length == 2) {
        if(reversi.makeMove(data.coords[0], data.coords[1], game)) {
          game.turn = reversi.switchPlayer(game.turn);
          if(!reversi.canMove(game)) {
            game.turn = reversi.switchPlayer(game.turn);
            if(!reversi.canMove(game)) {  // game ends if no move is possible
                game.winner = reversi.getWinner(game.board);
                delete games[game.id];
            }
          }
          io.sockets.in('game/' + socket.playing).emit('game move', {
            'coords': data.coords,
            'turn': game.turn,
            'winner': game.winner
          });
        }
      }
    });

    /**
     * game request
     */
    socket.on('request', function(data) {
      if(!data.username || !users[data.username]) return;
      var requestSocket = io.sockets.socket(users[data.username].socket_id);
      if(socket.playing || requestSocket.playing) return;

      if(data.status == 'request') {
        if(!requestSocket.requests[socket.username]) {
          requestSocket.requests[socket.username] = {
            'username': socket.username
          };
          socket.requested = data.username;
          requestSocket.emit('request', {'status': 'request', 'username': socket.username});
        }
      } else if( data.status == 'deny') {
        delete socket.requests[data.username];
        delete requestSocket.requests[socket.username];
        if(socket.requested == requestSocket.username) {
          socket.requested = null;
        } else {
          requestSocket.requested = null;
        }
        requestSocket.emit('request', {'status': 'deny', 'username': socket.username});
      } else if ( data.status == 'accept') {
          socket.requested = null;
          requestSocket.requested = null;
          if(socket.playing || requestSocket.paying) return;
          delete requestSocket.requests[socket.username];
          for(request in requestSocket.requests) {
            if(users[request]) {
              io.sockets.socket(users[request].socket_id).emit('request', {
                'status': 'deny',
                'username': requestSocket.username
              });
            }
          }
          requestSocket.requests = [];

          delete socket.requests[data.username];
          for(request in socket.requests) {
            if(users[request]) {
              io.sockets.socket(users[request].socket_id).emit('request', {
                'status': 'deny',
                'username': socket.username
              });
            }
          }
          socket.requests = [];

          var game = reversi.createGame(socket.username, data.username);
          var id = Math.floor(Math.random() * 999999999999);
          game.id = id;
          games[id] = game;

          io.sockets.socket(users[data.username].socket_id).playing = game.id;
          socket.playing = game.id;
          socket.join('game/' + game.id);
          requestSocket.join('game/' + game.id);
          io.sockets.in('game/' + game.id).emit('request', {
            'status': 'accept',
            'game': game.id,
            'lights': socket.username,
            'darks': data.username,
            'board': game.board,
            'turn':'dark'
          });
          io.sockets.emit('game start', {'users': [socket.username, data.username] });
      }
    });

    /**
     * disconnect
     */
    socket.on('disconnect', function (data) {
      io.sockets.emit('user disconnection', {'user': socket.username});
      if(socket.playing) {
        socket.broadcast.to('game/' + socket.playing).emit('game leave', {
          'username': socket.username
        });
        socket.leave('game/' + socket.playing);
        delete games[socket.playing];
      }
      else {
        for(request in socket.requests) {
          if(users[request]) {
            io.sockets.socket(users[request].socket_id).emit('request', {
              'status': 'deny',
              'username': socket.username
            });
          }
        }
        if(socket.requested) {
          io.sockets.socket(users[socket.requested].socket_id).emit('request', {
            'status': 'deny',
            'username': socket.username
          });
        }
      }
      delete users[socket.username];
    });
  });

  /************************
   ***** START SERVER *****
   ************************/

  server.listen(port);
  console.log('Server listening on port ' + port);
});
