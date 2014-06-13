(function($) {

  /**
   * socket.io variable
   */
  var socket = null;

  /**
   * Application object
   */
  var App = {
    /**
     * user name
     */
    userName: null,

    /**
     * users panel element
     */
    usersPanel: $('#users-panel'),

    /**
     * game panel element
     */
    gamePanel: $('#game-panel'),

    /**
     * main room user list element
     */
    userList: $('#users'),

    /**
     * main chat element
     */
    mainChat: $('#chat'),

    /**
     * main chat input field
     */
    chatInput: $('#chat-form #chat-input'),

    /**
     * game chat element
     */
    gameChat: $('#game-chat'),

    /**
     * game chat input
     */
    gameChatInput: $('#game-chat-form #game-chat-input'),

    /**
     * add a user to the main room users list
     *
     * @param string user - the user name to be addded
     * @param boolean playing - user is currently playing
     * @param boolean notice - add notice message to the chat room
     */
    addUser: function(user, notice) {
      var n = 0;
      var inserted = false;
      var classes = '';
      if(user.playing) classes = ' playing';
      if(user.username == App.userName) classes += ' me';
      if(user.bot == true) {
        classes += ' bot';
      }
      
      var currentUsers = this.userList.find('li');
      var userElement = '<li id="u-' + user.username + '" class="user' + classes
      + '" data-username="' + user.username + '">'
      + user.username + '</li>';

      for(n=0;n<currentUsers.length;n++) {
        var currentElement = $(currentUsers[n]);
        if(currentElement.data('username') > user.username) {
          currentElement.before(userElement);
          inserted = true;
          break;
        }
      }

      if(!inserted) {
        this.userList.append(userElement);
      }

      if(notice) {
        App.addChat(user.username + ' joined Rev&#477;rsi Heroes.</li>');
      }
    },

    /**
     * add a chat message in the main chat room
     *
     * @param string message
     * @param string user
     */
    addChat: function(message, user, el) {
      el = el || App.mainChat;
      var classes = '';
      if(user) {
        message = '<i class="chat-username">' + user + ':</i> ' + escapeHtml(message);
      } else {
        classes = ' class="server-message"';
      }
      el
        .append('<li' + classes + '>' + message + '</li>')
        .animate({ scrollTop: el.height() }, 800);
      return this;
    }
  }

  /***********************
   ***** GAME OBJECT *****
   ***********************/

  var reversi = {
    /**
     * game id
     */
    id: null,

    /**
     * user disk color
     */
    disk: null,

    /**
     * game turn color
     */
    turn: null,

    /**
     * game board
     */
    board: null,

    /**
     * winner
     */
     winner: null,

    /**
     * draw the board
     */
    drawBoard: function() {
      var darks = 0;
      var lights = 0;
      for(y=0;y<8;y++) {
        for(x=0;x<8;x++) {
          var square = $('#' + x + '-' + y);
          square.removeClass('disk darks lights');
          if(this.board[x][y]) {
            square.addClass('disk ' + this.board[x][y]);
          }
          if(square.hasClass('darks')) {
            darks++;
          } else if(square.hasClass('lights')) {
            lights++;
          }
        }
      }
      $('#light-disks-count').text(lights + ' disks');
      $('#dark-disks-count').text(darks + ' disks');
    },

    /**
     * check board paths and return true if it is a valid move or false if it is not
     *
     * @param int x
     * @param int y
     * @param string xStep
     * @param string yStep
     * @param bool updateBoard
     * @param int step
     */
    checkPaths: function(x, y, xStep, yStep, updateBoard, step) {
      var updateBoard = updateBoard || false;
      var step = step || 0;

      if(xStep == 'U') x++;
      else if(xStep == 'D') x--;

      if(yStep == 'U') y++;
      else if(yStep == 'D') y--;

      if(x > 7 || x < 0 || y > 7 || y < 0) return false;

      if(this.board[x][y] == this.turn ) {
        if(step > 0) return true;
        else return false;
      }
      else {
        if(this.board[x][y] != undefined) {
          var val = this.checkPaths(x, y, xStep, yStep, updateBoard, ++step);
          if(val == true && updateBoard) {
            this.board[x][y] = this.turn;
          }
          return val;
        }
        else return false;
      }
    },

    /**
     * check if move is valid
     *
     * @param int x
     * @param int y
     */
    isValidMove: function(x, y) {
      return (this.board[x][y] == undefined
        && (this.checkPaths(x, y, 0, 'D')   // up
        || this.checkPaths(x, y, 0, 'U')    // down
        || this.checkPaths(x, y, 'D', 0)    // left
        || this.checkPaths(x, y, 'U', 0)    // right
        || this.checkPaths(x, y, 'D', 'D')  // left up
        || this.checkPaths(x, y, 'U', 'D')  // right up
        || this.checkPaths(x, y, 'D', 'U')  // left down
        || this.checkPaths(x, y, 'U', 'U')) // right down
      );
    },

    /**
     * make a move on the board
     *
     * @param int x
     * @param int y
     */
    makeMove: function(x, y) {
      if(this.isValidMove(x, y)) {
        this.checkPaths(x, y, 0, 'D', true);   // up
        this.checkPaths(x, y, 0, 'U', true);   // down
        this.checkPaths(x, y, 'D', 0, true);   // left
        this.checkPaths(x, y, 'U', 0, true);   // right
        this.checkPaths(x, y, 'D', 'D', true); // left up
        this.checkPaths(x, y, 'U', 'D', true); // right up
        this.checkPaths(x, y, 'D', 'U', true); // left down
        this.checkPaths(x, y, 'U', 'U', true); // right down
        this.board[x][y] = this.turn;
        return true;
      }
      return false;
    },

    /**
     * end game
     *
     * @param string message
     */
     endGame: function(message) {
       $('#board-message-text').text(message);
       $('#board-message').addClass('show').show();
     }
  };

  /*************************
   ***** SOCKET EVENTS *****
   *************************/

  var initSocket = function() {
    socket = io.connect();

    /**
     * sound variables
     */
    var clickSnd = new Howl({urls: ['/snd/click.wav']});
    var bellSnd = new Howl({urls: ['/snd/bell.wav']});

    /**
     * initialize application
     */
    socket.on('init', function(data) {
      $('#loading-panel').hide();
      App.userName = data.username;
      App.gamePanel.hide();
      App.userList.empty();
      App.mainChat.empty();
      App.usersPanel.show();
      App
        .addChat('Welcome to Rev&#477;rsi Heroes. Your user name is ' + data.username + '.')
        .addChat('Click on the users with the green light to start playing.');

      for(user in data.users) {
        App.addUser(data.users[user], false);
      }

      /**
       * users list click event
       */
      $(document).on('click', '.user', function(e) {
        if($(e.currentTarget).hasClass('playing') || $(e.currentTarget).hasClass('me')) return;
        $('#request-panel-message')
          .text('Request a game play with ' + $(e.currentTarget).data('username') + '.');
        $('#request-panel-accept')
          .removeAttr('disabled')
          .data('username', $(e.currentTarget).data('username'));
        $('#request-panel-default-buttons').show();
        $('#request-panel-close').hide();
        $('#request-panel-deny').data('username', $(e.currentTarget).data('username'));
        $('body,html').animate( { scrollTop: '0px' });
        $('#game-request-panel')
          .removeClass('slideUp')
          .addClass('slideDown');
      });

      /**
       * accept request button click event
       */
      $(document).on('click', '.accept-request', function(e) {
        var parent = $(this).parent().parent('.notification');
        socket.emit('request', {'status':'accept', 'username': parent.data('username') });
        $('#notifications-panel').empty();
      });

      /**
       * deny request button click event
       */
      $(document).on('click', '.deny-request', function(e) {
        var parent = $(this).parent().parent('.notification');
        socket.emit('request', {'status': 'deny', 'username': parent.data('username')});
        parent.remove();
      });
    });

    /**
     * new user connects
     */
    socket.on('user connection', function(data) {
      App.addUser({'username': data.user, 'playing': false}, true);
    });

    /**
     * user disconnects
     */
    socket.on('user disconnection', function(data) {
      App.userList.children('#u-' + data.user).remove();
      App.addChat(data.user + ' left Rev&#477;rsi Heroes.');
    });

    /**
     * socket chat event
     */
    socket.on('chat', function(data) {
      App.addChat(data.message, data.username);
    });

    /**
     * socket chat event
     */
    socket.on('game chat', function(data) {
      App.addChat(data.message, data.username, App.gameChat);
    });

    /**
     * socket request event
     */
    socket.on('request', function(data) {
      if(data.status == 'request') {
        $('#notifications-panel').append('<div class="notification container slideDown" id="r-' + data.username
        + '" data-username="' 
        + data.username + '">Game request by '
        + data.username 
        + '.<span><button class="accept-request">Accept</button>'
        + '<button class="deny-request">Deny</button></span></div>')
        .show();
        bellSnd.play();
      }
      else if ( data.status == 'deny') {
        $('#request-panel-message').text(data.username + " didn't accept your request.");
        $('#request-panel-default-buttons').hide();
        $('#request-panel-close').show();
        $('#notifications-panel #r-' + data.username).remove();
      }
      else if (data.status == 'accept') {
        reversi.board = data.board;
        reversi.turn = data.turn;

        var oponent = '';
        if(data.lights == App.userName) {
          reversi.disk = 'lights';
          $('#dashboard-turn').text('Darks turn');
          oponent = data.darks;
        } else {
          reversi.disk = 'darks';
          $('#dashboard-turn').text('Your turn');
          oponent = data.lights;
        }
        reversi.drawBoard();
        App.gameChat.empty();
        App
          .addChat('You are now playing with ' + oponent + '.', false, App.gameChat)
          .addChat('Dark player moves first.', false, App.gameChat);
        $('#notifications-panel').empty();
        App.usersPanel.hide();
        $('#dashboard-end-game').show();
        $('#board-message').hide();
        $('#dashboard-light').text(data.lights);
        $('#dashboard-dark').text(data.darks);
        App.gamePanel.show();
        $('#game-request-panel').removeClass('slideDown').addClass('slideUp');
      }
    });

    /**
     * socket on game start
     */
    socket.on('game start', function(data) {
      if(!App.userList.children('#u-' + data.users[0]).hasClass('bot')) {
        App.userList.children('#u-' + data.users[0]).addClass('playing');
      }
      if(!App.userList.children('#u-' + data.users[1]).hasClass('bot')) {
        App.userList.children('#u-' + data.users[1]).addClass('playing');
      }
      App.addChat(data.users[0] + ' and ' + data.users[1] + ' started a new game.');
    });

    /**
     * socket on game end
     */
    socket.on('game end', function(data) {
      App.userList.children('#u-' + data.username).removeClass('playing');
    });

    /**
     * user forced the game to end
     */
    socket.on('game force end', function(data) {
      reversi.endGame(data.username + ' ended the game');
      $('#dashboard-end-game').hide();
      App.addChat(data.username + ' ended the game.', false, App.gameChat);
    });

    /**
     * user leaves a game
     */
    socket.on('game leave', function(data) {
      App.addChat(data.username + ' left the game.', false, App.gameChat);
      if(!reversi.winner) {
        reversi.endGame(data.username + ' left the game')
      }
      $('#dashboard-end-game').hide();
    });

    /**
     * socket on game move
     */
    socket.on('game move', function(data) {
      var coords = data.coords;
      reversi.makeMove(coords[0], coords[1]);
      reversi.drawBoard();
      reversi.turn = data.turn;
      var turnMsg = '';
      if(reversi.turn == reversi.disk) {
        turnMsg = 'Your turn';
      } else if(reversi.turn == 'lights') {
        turnMsg = 'Lights turn';
      } else {
        turnMsg = 'Darks turn';
      }
      $('#dashboard-turn').text(turnMsg);
      if(data.winner) {
        reversi.winner = data.winner;
        reversi.endGame(data.winner + ' win');
      }
      clickSnd.play();
    });
  };

   /**********************
    ***** APP EVENTS *****
    **********************/

    /**
     * click board message button when a game ends
     */
    $('#board-message-button').on('click', function(e) {
      e.preventDefault();
      socket.emit('game end');
      App.userList.children('#u-' + App.userName).removeClass('playing');
      App.gamePanel.hide();
      App.usersPanel.show();
    });

    /** 
     * click on a square to add a disk
     */
    var squares = $('.square');
    squares.on('click', function(e) {
      if(reversi.turn != reversi.disk) return;
      var coords = $(e.currentTarget).attr('id').split('-');
      if(!reversi.makeMove(coords[0], coords[1])) {
        return;
      }
      reversi.drawBoard();
      socket.emit('game move', {coords: coords});
      if (reversi.turn == 'lights') {
        reversi.turn = 'darks';
      } else {
        reversi.turn = 'lights';
      }
    });

    /**
     * click the accept button in the requests panel
     */
    $('#request-panel-accept').on('click', function(e) {
      $('#request-panel-message').text('Sending request to '
      + $(e.currentTarget).data('username') + '...');
      $(e.currentTarget).attr('disabled', 'disabled');
      socket.emit('request', {
        status:'request',
        username: $(e.currentTarget).data('username')
      });
    });

    /**
     * click the deny button in the requests panel
     */
    $('#request-panel-deny').on('click', function(e) {
      $('#game-request-panel').removeClass('slideDown').addClass('slideUp');
      socket.emit('request', {
        status:'deny',
        username: $(e.currentTarget).data('username')
      });
    });

    /**
     * close game request panel
     */
    $('#request-panel-close').on('click', function(e) {
      $('#game-request-panel').removeClass('slideDown').addClass('slideUp');
    });

    /**
     * submit the chat form in the main room
     */
    $('#chat-form').on('submit', function(e) {
      e.preventDefault();
      var msg = App.chatInput.val();
      App.chatInput.val('');
      App.addChat(msg, App.userName);
      socket.emit('chat', {'message':msg});
    });

    /**
     * submit the chat form in the game room
     */
    $('#game-chat-form').on('submit', function(e) {
      e.preventDefault();
      var msg = App.gameChatInput.val();
      App.gameChatInput.val('');
      App.addChat(msg, App.userName, App.gameChat);
      socket.emit('game chat', {'message':msg});
    });

    /**
     * end game
     */
     $('#dashboard-end-game').on('click', function(e) {
       reversi.endGame('You ended the game');
       App.addChat('You ended the game.', false, App.gameChat);
       socket.emit('game force end');
       $(this).hide();
     });

     /**
      * helper function to escape html in chat messages
      */
     function escapeHtml(str) {
         return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ;
     }

     // initialize socket
    initSocket();
})(jQuery);