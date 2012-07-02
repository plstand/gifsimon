var LCG = require('./lcg').LCG;
var NUM_BUTTONS = 4;
var ATTRACT_PHRASE = '   PrE55 ANy button to 5tart   ';
var LOSE_PHRASE = '   you L05E   ';

function TEMPO(round) {
  if (round > 12) return 120;
  if (round > 8) return 180;
  if (round > 4) return 240;
  return 300;
}

function Game(state) {
  if (state) {
    this.state = state;
  } else {
    this.state = Game.createInitialState();
  }
}

Game.createInitialState = function() {
  return {
    event: 'attract',
    seed: Math.floor(Date.now() / 1000),
    round: 0,
    signal: 0,
    lasthit: -1,
    lasthittime: Date.now(),
    slicesloaded: 0
  };
};

Game.prototype.view = function(hack) {
  var prng = new LCG(this.state.seed);
  var x;
  var button;

  // No

  // Continuously scroll ATTRACT_PHRASE in attract mode.
  if (this.state.event === 'attract') {
      hack.loop(Infinity);
      for (x = 0; x < ATTRACT_PHRASE.length - 2; x++) {
        hack.display(ATTRACT_PHRASE.substr(x, 3));
        hack.delay(250);
      }
      return hack.end();
  }

  // Show score. If the no-op button is pressed,
  // this should be the only thing showing.
  hack.display(('000' + this.state.round).slice(-3));
  if (this.state.event === 'noop') {
    return hack.end();
  }

  // Flash the correct button if that was pressed.
  if (this.state.event === 'good' || this.state.event === 'gotit') {

    hack.light(this.state.lasthit);
    hack.delay(250);
    hack.extinguish(this.state.lasthit);

    // Bail out early unless the sequence is complete.
    if (this.state.event !== 'gotit') {
      return hack.end();
    }

    hack.delay(1000);

  } else if (this.state.event === 'wrong') {
    // Clear display to prevent '000' from showing.
    hack.display('   ');

    // Simultaneously flash all buttons while scrolling
    // the lose phrase, and then start a new game after
    // two more seconds.
    var losePhraseFrames = Math.ceil((LOSE_PHRASE.length - 2) / 2) * 2;
    for (x = 0; x < losePhraseFrames; x++) {
      hack.delay(250);
      hack.display(LOSE_PHRASE.substr(x, 3));
      for (button = 0; button < NUM_BUTTONS; button++) {
	hack.setLamp(button, x % 2 === 0);
      }
    }
    hack.delay(this.state.round ? 500 : 1000);

    // Show score (which should be '000').
    hack.display(('000' + this.state.round).slice(-3));

  }

  hack.delay(1000);

  // Display all signals for this round.
  var tempo = TEMPO(this.state.round);
  for (x = 0; x <= this.state.round; x++) {
    button = Math.floor(prng.random() * NUM_BUTTONS);
    hack.light(button);
    hack.delay(tempo / 2);
    hack.extinguish(button);
    hack.delay(tempo);
  }

  return hack.end();
};

Game.prototype.hit = function(button) {

  var now = Date.now();

  // Ensure the player sees he/she has lost.
  if (this.state.event === 'wrong' && now - this.state.lasthittime < 2000) {
    return;
  }

  this.state.lasthit = button;
  this.state.lasthittime = now;

  // Always ignore the no-op button, but ensure the player does not
  // see the current sequence again.
  if (button < 0) {
    if (this.state.event !== 'attract') {
      this.state.event = 'noop';
    }
    return;
  }

  // If the game is in attract mode, ignore the first hit.
  if (this.state.event === 'attract') {
    this.state.event = 'listen';
    return;
  }

  var prng = new LCG(this.state.seed);

  // Skip signals already entered.
  for (var x = 0; x < this.state.signal; x++) {
    prng.random();
  }

  var correctButton = Math.floor(prng.random() * NUM_BUTTONS);
  if (button === correctButton) {

    // Player hit the right button; continue the sequence.
    this.state.event = 'good';
    this.state.signal++;

    if (this.state.signal > this.state.round) {
      // Player correctly entered the entire sequence; start the next round.
      this.state.event = 'gotit';
      this.state.round++;
      this.state.signal = 0;
    }

  } else {
    // Player screwed up; game over.
    this.state.event = 'wrong';
    this.state.seed = prng.seed;
    this.state.round = 0;
    this.state.signal = 0;
  }

};

exports.Game = Game;
