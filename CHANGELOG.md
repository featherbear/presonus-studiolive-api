# Changelog

## [1.8.0] - 2026-03-25

### Breaking Changes
- Node.js imports now use `node:` protocol (requires Node.js 16+)

### Fixed
- **Per-client instance isolation**: Eliminated global mutable state (`chunkBuffer`, `BufferCollector`, `UniqueRandom`) that caused data corruption when running multiple `Client` instances concurrently
- **Connection lifecycle**: Added 15s connection + handshake timeouts; `connect()` no longer hangs indefinitely on unreachable hosts
- **Reconnection**: `connectPromise` now resets on `close()` / failure, allowing proper reconnection
- **DataClient queue deadlock**: TCP frame parser errors no longer stall the packet queue (wrapped in `try/catch/finally`)
- **MeterServer crash**: UDP error handler now rejects the promise instead of throwing (which crashed the process)
- **Silent write failures**: `_writeBytes` now guards against destroyed / non-writable sockets
- **KeepAliveHelper leak**: Timer is now properly cleared on `close()`
- **tokenisePath cache mutation**: Memoization returns defensive copies so callers that `.shift()` cannot corrupt the cache
- **Discovery false positives**: Filtered out local machine IPs and localhost from device discovery results
- **Discovery noise**: Removed debug `console.log` statements
- **npm security vulnerabilities**: Updated transitive dependency overrides (`minimatch`, `glob`, `rimraf`)

### Added
- `SleepWakeDetector` — detects system sleep/wake cycles to trigger reconnection
- Discovery now reports device name alongside IP address
- Comprehensive test suite (130+ tests via vitest) covering all core modules
- MIT license file
- This changelog

### Changed
- `UniqueRandom.#active` uses `Set` instead of `Array` for O(1) membership checks
- `recallProject`, `recallProjectScene`, `recallChannelStrip` now return the `_sendPacket` promise
- Lint fixes: unused parameters prefixed with `_`, `node:` import protocol throughout
- Build tooling: switched to SWC transpiler with dual ESM/CJS output

## [1.7.2] - Previous release

See [git history](https://github.com/featherbear/presonus-studiolive-api/commits/v1.7.2) for earlier changes.
