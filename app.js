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
  , expressValidator = require('express-validator')
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

  // set up the view engine
  app.engine('html', swig.renderFile);
  app.set('view engine', 'html');
  app.set('views', __dirname + '/views');
  swig.setDefaults({ 'cache': false });

  // routes
  var routes = require('./lib/routes').create({ 'db': db, 'mandrillAuth': mandrillAuth, 'users': users });

  app.get('/', routes.getHome);
  app.post('/', routes.postSignIn);
  app.get('/signup', routes.getSignUp);
  app.post('/signup', routes.postSignUp);
  app.get('/guest', routes.getGuest);
  app.get('/play', routes.authMiddleware, routes.getPlay);
  app.get('/settings', routes.authMiddleware, routes.notGuestMiddleware, routes.getSettings);
  app.post('/settings', routes.authMiddleware, routes.notGuestMiddleware, routes.postSettings);
  app.get('/signout', routes.getSignOut);
  app.get('/recovery', routes.getRecovery);
  app.post('/recovery', routes.postRecovery);
  app.get('/recovery/:token', routes.getRecoverySignIn);
  app.get('/rules', routes.getRules);

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
