/**********************
 ***** GAME RULES *****
 **********************/

/**
 * create a new game
 *
 * @param light int - light player's id
 * @param dark int - dark player's id
 */
exports.createGame = function(light, dark) {
    var board = new Array(8);
    for(i=0;i<8;i++) {
      board[i] = new Array(8);
    }
    board[3][3] = 'lights';
    board[4][4] = 'lights';
    board[3][4] = 'darks';
    board[4][3] = 'darks';
  
  return {
    'lights': light,
    'darks': dark,
    'board': board,
    'turn': 'darks',
    'winner': null
  };
}

/**
 * check board paths and return true if it is a valid move or false if it is not
 *
 * @param int x
 * @param int y
 * @param string xStep
 * @param string yStep
 * @param bool updateBoard
 * @param object game
 * @param int step
 */
exports.checkPaths = function(x, y, xStep, yStep, updateBoard, game, step) {
  var updateBoard = updateBoard || false;
  var step = step || 0;

  if(xStep == 'U') x++;
  else if(xStep == 'D') x--;

  if(yStep == 'U') y++;
  else if(yStep == 'D') y--;

  if(x > 7 || x < 0 || y > 7 || y < 0) return false;

  if(game.board[x][y] == game.turn ) {
    if(step > 0) return true;
    else return false;
  }
  else {
    if(game.board[x][y] != undefined) {
      var val = this.checkPaths(x, y, xStep, yStep, updateBoard, game, ++step);
      if(val == true && updateBoard) {
        game.board[x][y] = game.turn;
      }
      return val;
    }
    else return false;
  }
}

/**
 * check if move is valid
 *
 * @param int x
 * @param int y
 * @param object game
 */
exports.isValidMove = function(x, y, game) {
  return (game.board[x][y] == undefined
    && (this.checkPaths(x, y, 0, 'D', false, game)   // up
    || this.checkPaths(x, y, 0, 'U', false, game)    // down
    || this.checkPaths(x, y, 'D', 0, false, game)    // left
    || this.checkPaths(x, y, 'U', 0, false, game)    // right
    || this.checkPaths(x, y, 'D', 'D', false, game)  // left up
    || this.checkPaths(x, y, 'U', 'D', false, game)  // right up
    || this.checkPaths(x, y, 'D', 'U', false, game)  // left down
    || this.checkPaths(x, y, 'U', 'U', false, game)) // right down
  );
}

/**
 * make a move on the board
 *
 * @param int x
 * @param int y
 * @param object game
 */
exports.makeMove = function(x, y, game) {
  if(this.isValidMove(x, y, game)) {
    this.checkPaths(x, y, 0, 'D', true, game);   // up
    this.checkPaths(x, y, 0, 'U', true, game);   // down
    this.checkPaths(x, y, 'D', 0, true, game);   // left
    this.checkPaths(x, y, 'U', 0, true, game);   // right
    this.checkPaths(x, y, 'D', 'D', true, game); // left up
    this.checkPaths(x, y, 'U', 'D', true, game); // right up
    this.checkPaths(x, y, 'D', 'U', true, game); // left down
    this.checkPaths(x, y, 'U', 'U', true, game); // right down
    game.board[x][y] = game.turn;
    return true;
  }
  return false;
}

/**
 * check if user can move
 *
 * @param object game
 */
exports.canMove = function(game) {
  for(y=0;y<8;y++) {
    for(x=0;x<8;x++) {
      if(this.isValidMove(x, y, game)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * get the winner of the game
 *
 * @param array board
 */
exports.getWinner = function(board) {
  var light = 0;
  var dark = 0;
  for(y=0;y<8;y++) {
    for(x=0;x<8;x++) {
      if(board[x][y] == 'lights') {
        light++;
      }
      else if(board[x][y] == 'darks'){
        dark++;
      }
    }
  }

  if(light == dark) return 'draw';
  else if(light > dark) return 'lights';
  else return 'darks';
}

/**
 * switch player
 *
 * @param string player
 */
exports.switchPlayer = function(player) {
  return (player == 'lights')? 'darks' : 'lights';
}
