// Stockfish Worker Wrapper (ES Module)

// Configure Module before importing Stockfish
self.Module = {
  locateFile: function(path) {
    if (path.endsWith('.wasm')) {
      return new URL('/engine/stockfish-17.1-lite-single-03e3232.wasm', import.meta.url).href;
    }
    return path;
  },
  print: function(text) {
    self.postMessage(text);
  },
  printErr: function(text) {
    console.error('[Stockfish]', text);
  }
};

// Import Stockfish
importScripts('/engine/stockfish-17.1-lite-single-03e3232.js');

// Handle commands from main thread
self.onmessage = function(e) {
  var command = e.data;
  if (typeof command === 'string' && self.Module && self.Module.ccall) {
    try {
      self.Module.ccall('command', null, ['string'], [command]);
    } catch (err) {
      console.error('[Worker] Command error:', err);
    }
  }
};
