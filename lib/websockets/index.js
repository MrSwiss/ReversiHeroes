var games = {}
  , cookie = require('express/node_modules/cookie')
  , connectUtils = require('express/node_modules/connect/lib/utils')
  , reversi = require('../reversi');

module.exports.init = function (appUsers, appBots){
  users = appUsers;
  bots = appBots;
};

/**
 * socket authorization
 */
module.exports.authorization = function (data, accept, SECRET) {
   if (data.headers.cookie) {
     data.cookie = cookie.parse(data.headers.cookie, SECRET);
     data.cookie = connectUtils.parseSignedCookie(data.cookie['express.sid'], SECRET);
     data.cookie = connectUtils.parseJSONCookie(data.cookie);
     accept(null, true);
   } else {
      accept('No cookie transmitted.', false);
   }
};

/**
 * socket connection
 */
module.exports.connection = function(config) {
  var socket = config.socket;
  var io = config.io;
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
    if(users[user].bot == true) {
      u['bot'] = true;
      u['playing'] = false;
      u['username'] = users[user].username;
    }  else {
      u['playing'] = io.sockets.socket(users[user].socket_id).playing; 
      u['username'] = user;
    }
    init_users[user] = u;
  }

  socket.broadcast.emit('user connection', { user: socket.username });
  socket.emit('init', { username: socket.username, users: init_users });

  /**
   * delete the socket game requests
   *
   * @param object socket
   */
  function deleteRequests(socket) {
    if(socket.requested) {
      io.sockets.socket(users[socket.requested].socket_id).emit('request', {
        'status': 'deny',
        'username': socket.username
      });
    }

    for(request in socket.requests) {
      if(users[request]) {
        io.sockets.socket(users[request].socket_id).emit('request', {
          'status': 'deny',
          'username': socket.username
        });
      }
    }
    socket.requests = [];
  }

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

        // move bot disk
        if(game.bot == true && (game[game.turn] !== socket.username)) {
          var bot = bots[0];
          for(var i=0;i<bots.length;i++) {
            if(bots[i].name == game[game.turn]) {
              bot = bots[i];
              break;
            }
          }
          do {
            var botMove = bot.move(game);
            game.turn = reversi.switchPlayer(game.turn);
            if(!reversi.canMove(game)) {
              game.turn = reversi.switchPlayer(game.turn);
              if(!reversi.canMove(game)) {  // game ends if no move is possible
                  game.winner = reversi.getWinner(game.board);
                  delete games[game.id];
              }
            }

            io.sockets.in('game/' + socket.playing).emit('game move', {
              'coords': botMove,
              'turn': game.turn,
              'winner': game.winner
            });
          } while(games[game.id] && (game[game.turn] !== socket.username));
        }
      }
    }
  });

  /**
   * game request
   */
  socket.on('request', function(data) {
    if(!data.username || socket.playing) return;
    if(users[data.username] && (users[data.username].bot == true)) { // bot game
        if (data.status != 'request') return;
        var game = reversi.createGame(data.username, socket.username);
        var id = Math.floor(Math.random() * 999999999999);
        game.id = id;
        game.bot = true;
        games[id] = game;
        socket.playing = game.id;
        socket.join('game/' + game.id);
        io.sockets.in('game/' + game.id).emit('request', {
          'status': 'accept',
          'game': game.id,
          'lights': data.username,
          'darks': socket.username,
          'board': game.board,
          'turn': 'darks'
        });
        io.sockets.emit('game start', {'users': [socket.username, data.username] });
      } else { // user game
        if(!users[data.username]) return;
        var requestSocket = io.sockets.socket(users[data.username].socket_id);
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
            deleteRequests(requestSocket);
            delete socket.requests[data.username];
            deleteRequests(socket);

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
              'turn':'darks'
            });
            io.sockets.emit('game start', {'users': [socket.username, data.username] });
        }
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
      deleteRequests(socket);
    }
    delete users[socket.username];
  });
}
