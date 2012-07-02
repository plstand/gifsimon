var fs = require('fs');

var SEVEN_SEGMENT_CHARACTERS = {
  ' ': 0x00,
  '0': 0x3f,
  '1': 0x06,
  '2': 0x5b,
  '3': 0x4f,
  '4': 0x66,
  '5': 0x6d,
  '6': 0x7d,
  '7': 0x07,
  '8': 0x7f,
  '9': 0x6f,
  'A': 0x77,
  'a': 0x5f,
  'b': 0x7c,
  'E': 0x79,
  'L': 0x38,
  'N': 0x37,
  'o': 0x5c,
  'P': 0x73,
  'r': 0x50,
  't': 0x78,
  'u': 0x1c,
  'y': 0x6e
};

function loadTemplateToBuffers(filename, callback) {
  fs.readFile(filename, function(err, data) {

    var buffers = {};

    // Copy header and LSD.
    buffers.header = new Buffer(13);
    data.copy(buffers.header, 0, 0, 13);
    // Clear GCT flag and GCT size.
    buffers.header[10] &= ~0x87;
    // Clear background color index.
    buffers.header[11] = 0;

    // Copy existing GCT, which will serve as a template for the
    // first frame's LCT.
    var rawGctSize = data[10] & 0x07;
    var gctSize = 3 * (2 << rawGctSize);
    buffers.gct = new Buffer(gctSize);
    data.copy(buffers.gct, 0, 13, 13 + gctSize);

    // Search for the first LCT, whose entries will be used when
    // lights are turned on, as well as the first image block
    // and the graphic control extension.
    var pos = 13 + gctSize;
    var imageBlockPos, imageBlockSize;
    var imageDataPos, imageDataSize;
    var lctPos, lctSize;
    var gcePos, gceSize;

    function skipSubblocks() {
      // Skip subblocks, one at a time
      while (data[pos]) {
        pos += 1 + data[pos];
      }
      // Seek past block terminator
      pos++;
    }

    search: while (data[pos] != 0x3b) {
      switch (data[pos]) {

        case 0x2c: // Image block

          if (!imageBlockPos) {
            imageBlockPos = pos;
            imageBlockSize = 10;
          }

          if (data[pos + 9] & 0xff) {
              // Found the LCT!
              lctPos = pos + 10;
              lctSize = 3 * (2 << (data[pos + 9] & 0x07));
              pos = lctPos + lctSize;
          } else {
            pos += 10;
          }

          // Skip past data subblocks, saving the location if necessary.
          if (!imageDataPos) {
            imageDataPos = pos;
            pos++;
            skipSubblocks();
            imageDataSize = pos - imageDataPos;
            if (lctPos) {
              break search;
            }
          } else {
            if (lctPos) {
              break search;
            }
            pos++;
            skipSubblocks();
          }

        break;
        case 0x21: // Extension block
          // Save the GCE.
          if (!gcePos && data[pos + 1] === 0xf9) {
            gcePos = pos;
            pos += 2;
            skipSubblocks();
            gceSize = pos - gcePos;
          } else {
            pos += 2;
            skipSubblocks();
          }

        break;
        default:
          throw new Error('invalid block type');

      }
    }

    if (!imageBlockPos) {
      throw new Error('no image block found');
    }

    if (!lctSize) {
      throw new Error('no LCT found');
    }

    if (lctSize !== gctSize) {
      throw new Error('found GCT and LCT having different sizes');
    }

    buffers.imageBlock = new Buffer(imageBlockSize);
    data.copy(buffers.imageBlock, 0, imageBlockPos, imageBlockPos + imageBlockSize);
    // Set LCT flag and size.
    buffers.imageBlock[9] = (buffers.imageBlock[9] & ~0x07) | 0x80 | rawGctSize;

    buffers.gce = new Buffer(gceSize);
    data.copy(buffers.gce, 0, gcePos, gcePos + gceSize);

    buffers.lct = new Buffer(lctSize);
    data.copy(buffers.lct, 0, lctPos, lctPos + lctSize);

    buffers.imageData = new Buffer(imageDataSize);
    data.copy(buffers.imageData, 0, imageDataPos, imageDataPos + imageDataSize);

    callback(buffers);

  });
}

function GifHack(buffers, stream) {

  this.buffers = buffers;
  this.stream = stream;

  this.sentHeader = false;
  this.dirty = true;
  this.times = null;

  this.myGce = new Buffer(buffers.gce.length);
  this.buffers.gce.copy(this.myGce);

  this.myCt = new Buffer(buffers.gct.length);
  this.buffers.gct.copy(this.myCt);

}

GifHack.loadTemplateToBuffers = loadTemplateToBuffers;

GifHack.prototype.loop = function(times) {
  this.times = times;
};

GifHack.prototype.setLamp = function(lamp, state) {
  var pos = 3 * lamp;
  if (state) {
    this.buffers.lct.copy(this.myCt, pos, pos, pos + 3);
  } else {
    this.buffers.gct.copy(this.myCt, pos, pos, pos + 3);
  }
  this.dirty = true;
};

GifHack.prototype.light = function(lamp) {
  return this.setLamp(lamp, true);
};

GifHack.prototype.extinguish = function(lamp) {
  return this.setLamp(lamp, false);
};

GifHack.prototype.delay = function(ms) {
  this.myGce.writeUInt16LE(Math.floor(ms / 10), 4);
  this.dirty = true;
  this.flush();
};

GifHack.prototype.flush = function() {
  if (!this.dirty) {
    return;
  }

  var s = this.stream;

  if (!this.sentHeader) {
    s.write(this.buffers.header);
    this.sentHeader = true;
  }

  if (this.times) {
    // NETSCAPE application extension block
    // http://odur.let.rug.nl/~kleiweg/gif/netscape.html
    var naeb = new Buffer([
      0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50,
      0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00
    ]);
    if (this.times !== Infinity) {
      naeb.writeUInt16LE(this.times, 17);
    }
    this.stream.write(naeb);
  }

  s.write(this.myGce);
  s.write(this.buffers.imageBlock);
  s.write(this.myCt);
  s.write(this.buffers.imageData);

  this.dirty = false;
};

GifHack.prototype.end = function() {
  this.flush();
  this.stream.end(';');
};

GifHack.prototype.display = function(text) {
  for (var i = 0; i < 3; i++) {
    var c = SEVEN_SEGMENT_CHARACTERS[text[2 - i] || ' '];
    var segA = 4 + (7 * i);
    this.setLamp(segA, c & 0x01);
    this.setLamp(segA + 1, c & 0x02);
    this.setLamp(segA + 2, c & 0x04);
    this.setLamp(segA + 3, c & 0x08);
    this.setLamp(segA + 4, c & 0x10);
    this.setLamp(segA + 5, c & 0x20);
    this.setLamp(segA + 6, c & 0x40);
  }
}

exports.GifHack = GifHack;
