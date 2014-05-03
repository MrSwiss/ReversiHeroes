var reversi = require('../reversi');

/**
 * board strategy
 */
var boardScores = new Array(8);
for(var i=0;i<8;i++) {
  boardScores[i] = new Array(8);
  for(var n=0;n<8;n++) {
    boardScores[i][n] = 0;
  }
}
boardScores[0][0] = 6;
boardScores[0][7] = 6;
boardScores[7][0] = 6;
boardScores[7][7] = 6;
boardScores[1][1] = -1;
boardScores[1][6] = -1;
boardScores[6][1] = -1;
boardScores[6][6] = -1;
boardScores[0][1] = -1;
boardScores[0][6] = -1;
boardScores[1][0] = -1;
boardScores[6][0] = -1;
boardScores[7][1] = -1;
boardScores[7][6] = -1;
boardScores[1][7] = -1;
boardScores[6][7] = -1;
boardScores[2][2] = 2;
boardScores[2][5] = 2;
boardScores[5][2] = 2;
boardScores[5][5] = 2;

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