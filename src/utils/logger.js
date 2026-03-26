// Minimal logger that adds ISO timestamps to every log line.
// No external dependencies — wraps console directly.

function ts() {
  return new Date().toISOString();
}

module.exports = {
  info:  (...args) => console.log(`[${ts()}]`,   ...args),
  warn:  (...args) => console.warn(`[${ts()}]`,  ...args),
  error: (...args) => console.error(`[${ts()}]`, ...args),
};
