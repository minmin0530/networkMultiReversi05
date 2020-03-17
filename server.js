var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

//アクセスに対して反応を返す。 index.htmlファイルを返しています。
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var userHash = {};
var watchingNumber = 0;
var socketID = [];
var field = [];
var turn = [];
var fieldOwner = [];
var players = [];
var fieldNumberArray = [];
//初期化（オセロ盤と順番の初期化）
for (var v = 0; v < 3; ++v) {
    var arrayY = [];
    for (var y = 0; y < 8; ++y) {
        var arrayX = [];
        for (var x = 0; x < 8; ++x) {
            arrayX.push(-1);
        }
        arrayY.push(arrayX);
    }
    field.push(arrayY);
    turn.push(0);
}

const CONST_X = [ 8, -1,  8, -1,  8, -1,  8, -1];
const CONST_Y = [ 8,  8, -1, -1,  8, -1,  8, -1];
const ADD_X   = [ 1, -1,  1, -1,  1, -1,  0,  0];
const ADD_Y   = [ 1,  1, -1, -1,  0,  0,  1, -1];


//クライアントと接続。 
io.sockets.on("connection", function (socket) {

    var name = watchingNumber;
    userHash[socket.id] = name;
    socketID.push( socket.id );
    var getNameData = {
      'name': name,
      'fieldNumberArray': fieldNumberArray,
      'field': field
    };
    io.sockets.connected[socket.id].emit("getName", {value: getNameData});
    ++watchingNumber;

    // 誰かがコマを置いた処理をクライアントから受け取り
    socket.on("put", function (data) {
        field[data.value.fieldNumber][data.value.y][data.value.x] = data.value.turn;

        let x = data.value.x;
        let y = data.value.y;

        for (let i = 0; i < 8; ++i) {
          for (let xx = x, yy = y; xx != CONST_X[i] && yy != CONST_Y[i]; xx += ADD_X[i], yy += ADD_Y[i]) {
              if (field[data.value.fieldNumber][yy][xx] == data.value.turn) {
                  let breakFlag = false;
                  for (var xxx = x, yyy = y; (xxx != xx || ADD_X[i] == 0) && (yyy != yy || ADD_Y[i] == 0); xxx += ADD_X[i], yyy += ADD_Y[i]) {
                      if (field[data.value.fieldNumber][yyy][xxx] == -1) {//コマを置いてないマスがある場合、ループを抜ける
                          breakFlag = true;
                          break;
                      }
                  }
                  if (breakFlag) {
                      break;
                  }

                  for (var xxx = x, yyy = y; (xxx != xx || ADD_X[i] == 0) && (yyy != yy || ADD_Y[i] == 0); xxx += ADD_X[i], yyy += ADD_Y[i]) {
                      field[data.value.fieldNumber][yyy][xxx] = data.value.turn;
                      if (field[data.value.fieldNumber][yyy + ADD_Y[i]][xxx + ADD_X[i]] == data.value.turn) {//同じ色のコマが途中にあった場合、ループを抜ける
                          break;
                      }
                  }
              }
          }
        }
        
        data.value.turn += 1;
        data.value.turn = data.value.turn % players.length;
        var d = {
          'x':data.value.x,
          'y':data.value.y,
          'turn':data.value.turn,
          'field':field[data.value.fieldNumber],
          'fieldNumber':data.value.fieldNumber
        };

        // 全員にコマを置いた処理を送信
        io.sockets.to(data.value.fieldNumber).emit("put", {value:d});
    });

    // テーブルのオーナー作成者を決める
    socket.on("fieldOwner", function(data) {
      let i = 0;
      let existFlag = true;
      for (const fn of fieldNumberArray) {
        if (fn == 3) {
          fieldNumberArray[i] = 1;
          fieldOwner[i] = data.fieldOwner;
          existFlag = false;
          break;
        }
        ++i;
      }
      if (existFlag) {
        fieldNumberArray.push(1);
        fieldOwner[fieldNumberArray.length - 1] = data.fieldOwner;
      }
      players.push(data.fieldOwner);
      if (existFlag) {
        socket.join(fieldNumberArray.length - 1);
        io.sockets.connected[socketID[ fieldOwner[fieldNumberArray.length - 1] ]].emit("currentTable", fieldNumberArray.length - 1);      
      } else {
        socket.join(i);
        io.sockets.connected[socketID[ fieldOwner[i] ]].emit("currentTable", i);
      }
    });

    // 既にあるテーブルへ参加する
    socket.on("join", function(data) {
      let sameFlag = false;
      for (const player of players) {
        if (player == data.myName) {
          sameFlag = true;
        }
      }
      if (sameFlag == false) {
        players.push(data.myName);
      }

      const joinData = {
        number: players.length
      };
      socket.join(data.fieldNumber);
      io.sockets.connected[socketID[ fieldOwner[data.fieldNumber] ]].emit("join", joinData);
    });

    // ゲーム開始
    socket.on("startGame", function(data) {
      if (fieldNumberArray[data] == 1) {
        fieldNumberArray[data] = 2;
      }

      io.sockets.emit("startGame", {data:data, players: players});
    });

    // 離脱
    socket.on("disconnect", function () {
      if (userHash[socket.id]) {
        delete userHash[socket.id];
      }
    });



});

//アクセスを待ち受け。
http.listen(8080, function(){
  console.log('listening on *:8080');
});