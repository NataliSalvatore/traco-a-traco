importScripts('retouch.js');
self.onmessage = ({data}) => {
  const result = removeSpecks(data.input, data.value, data.paper);
  self.postMessage(result, [result.buffer]);
};
