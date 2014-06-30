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
  , swig = require('swig')
  , fs = require('fs')
  , cookie = require('express/node_modules/cookie')
  , expressValidator = require('express-validator')
  , port = 3000
  , users = {} 
  , bots = require('./lib/bots')
  , websockets = require('./lib/websockets');

// Mandrill authentication
var mandrillAuth =  {
  user: "",
  pass: ""
};

// if development.lock doesn't exist enable production mode
if (!fs.existsSync('./development.lock')) {
  app.settings.env = 'production';
  mandrillAuth = require('./settings').mandrillAuth;
}

app.set('appMode', app.settings.env);

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

  // add bots to the users object
  for(var i=0;i<bots.bots.length;i++) {
    users[bots.bots[i].name] = {
      'username': bots.bots[i].name,
      'bot': true
    }
  }

  /******************
   ***** ROUTES *****
   ******************/

  var routes = require('./lib/routes').create({ 
      'db': db
    , 'mandrillAuth': mandrillAuth
    , 'users': users
    , 'bots': bots
  });

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

  /*************************
   ***** SOCKET EVENTS *****
   *************************/

  /**
   * init websockets module
   */
  websockets.init(users, bots.bots);

   /**
    * check session cookie to authorize the socket and accept the connection
    */
   io.set('authorization', function(data, accept) {
     websockets.authorization(data, accept, SECRET);
   });

  /**
   * sockets connection
   */
  io.sockets.on('connection', function (socket) {
    websockets.connection({
      'socket': socket,
      'io': io
    });
  });

  /************************
   ***** START SERVER *****
   ************************/

  server.listen(port);
  console.log('Server listening on port ' + port);
});
