// Stockfish Web Worker - loads from CDN
importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');

// The importScripts will make Stockfish available globally
// Initialize the engine (old stockfish.js uses a different API)
if (typeof Stockfish === 'function') {
  console.log('[Worker] Stockfish loaded, initializing engine...');
  const engine = new Stockfish();
  
  // Forward messages from main thread to engine
  self.onmessage = function(e) {
    console.log('[Worker] Sending to engine:', e.data);
    engine.postMessage(e.data);
  };
  
  // Forward messages from engine to main thread
  engine.onmessage = function(line) {
    console.log('[Worker] Received from engine:', line);
    self.postMessage(line);
  };
  
  console.log('[Worker] Engine initialized');
} else {
  self.postMessage('error: Stockfish not loaded');
}
