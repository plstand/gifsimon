// Include necessary packages.
var url = require('url');
var express = require('express');
var Loop = require('futures').loop;

// Include game code from other files.
var Game = require('./game').Game;
var GifHack = require('./gifhack').GifHack;

// I already tried Express's session handling and failed, presumably
// because of parallel image downloading. Hence this hack that
// only works for one server process.
var mySessions = {};
var mySessionList = {};
mySessionList.head = {previous: null, data: null, next: null};
mySessionList.tail = mySessionList.head;

function removeNode(list, node) {
  if (list.head === node) {
    list.head = node.next;
  }
  if (list.tail === node) {
    list.tail = node.previous;
  }
  if (node.next) {
    node.next.previous = node.previous;
  }
  if (node.previous) {
    node.previous.next = node.next;
  }
}

function cleanupOldSessions() {
  var now = Date.now();
  var currentNode = mySessionList.head;
  while ((currentNode = currentNode.next)) {
    var sessionId = currentNode.data;
    if (now - mySessions[sessionId].state.lasthittime > 1800000) {
      delete mySessions[sessionId];
      removeNode(mySessionList, currentNode);
    } else {
      break;
    }
  }
}

// Set up the HTTP server.
var app = express.createServer(express.logger());
app.use(express['static'](__dirname + '/static'));
app.use(express.cookieParser());

app.get('/:sliceNum.gif', function(req, res, next) {

  var sliceNum = parseInt(req.params.sliceNum, 10);

  if (isNaN(sliceNum) || sliceNum < 0 || sliceNum > 3) {
    return next(new Error('invalid image slice number'));
  }

  var referer = req.header('Referer');
  if (referer) {
    var button = parseInt(url.parse(referer, true).query.simonhit, 10);
  }

  // *** BEGIN SESSION HANDLING HACK ***
  // Look up session.
  var sessionId = req.cookies.simon || ('' + Date.now());
  var session = mySessions[sessionId];
  if (!session) {
    session = mySessions[sessionId] = {};
    session.listNode = {previous: null, data: sessionId, next: null};
  }

  // Remove session from linked list.
  removeNode(mySessionList, session.listNode);
  session.listNode.next = null;

  // Add session to end of linked list.
  session.listNode.previous = mySessionList.tail;
  mySessionList.tail.next = session.listNode;
  mySessionList.tail = session.listNode;

  if (!session.state || isNaN(button)) {
    session.state = Game.createInitialState();
  }
  var game = new Game(session.state);
  // *** END SESSION HANDLING HACK ***

  // Detect button presses.
  var sliceBit = 1 << sliceNum;
  var differentButtons = (button !== game.state.lasthit);
  var reloadedSlice = ((game.state.slicesloaded & sliceBit) !== 0);

  if (!isNaN(button) && (differentButtons || reloadedSlice)) {
    game.hit(button);
    game.state.slicesloaded = sliceBit;
  } else {
    game.state.lasthittime = Date.now();
    game.state.slicesloaded |= sliceBit;
  }

  res.cookie('simon', sessionId);
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store',
    'Pragma': 'no-cache',
    'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT'
  });
  game.view(new GifHack(gifs[sliceNum], res));

});

// Load GIF files before accepting connections.
var gifs = [];
var loop = Loop();

loop.run(function(_next, _err, _i) {
  if (_i > 3) {
    return _next("break");
  }

  GifHack.loadTemplateToBuffers('graphics/simon_' + _i + '.gif', function(buffers) {
    gifs.push(buffers);
    _next(undefined, _i + 1);
  });

}, 0).when(function(_err, _i) {
  var port = process.env.PORT || 5000;
  app.listen(port, function() {

    console.log("Listening on " + port);

    // Periodically dispose of old sessions.
    setInterval(cleanupOldSessions, 900000);

  });
});
