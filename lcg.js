function LCG(seed) {
  this.seed = seed;
}

LCG.prototype.random = function() {
  this.seed = (1103515245 * this.seed + 12345) % 2147483648;
  return this.seed / 2147483648;
};

exports.LCG = LCG;
