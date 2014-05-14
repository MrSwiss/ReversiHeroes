var reversi = require('../reversi');

/**
 * board strategy scores
 */
var boardScores = new Array(8);
boardScores[0] = [ 10,  -5,  5,  4,  4,  5,  -5,  10 ]
boardScores[1] = [ -5, -10, -5,  0,  0, -5,  -10, -5 ]
boardScores[2] = [  5,  -5,  3,  1,  1,  3,  -5,   5 ]
boardScores[3] = [  4,   0, -5,  0,  0, -5,   0,   4 ]
boardScores[4] = [  4,   0, -5,  0,  0, -5,   0,   4 ]
boardScores[5] = [  5,  -5,  3,  1,  1,  3,  -5,   5 ]
boardScores[6] = [ -5, -10, -5,  0,  0, -5, -10,  -5 ]
boardScores[7] = [ 10,  -5,  5,  4,  4,  5,  -5,  10 ]

/**
 * bot name
 */
exports.name = 'easyBot';

/**
 * bot move disk function
 */
exports.move = function(game) {
  var score = 0;
  var move = null;

  for(y=0;y<8;y++) {
    for(x=0;x<8;x++) {
      if(reversi.isValidMove(x, y, game)) {
        if(boardScores[x][y] > score || move == null) {
          score = boardScores[x][y];
          move = [x, y]
        }
      }
    }
  }

  if(move != null) {
    reversi.makeMove(move[0], move[1], game);
  }
  return move;
}