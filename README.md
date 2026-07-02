# nexxus-api

> Executable API server built on top of the Nexxus library

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.0-blue.svg)](https://www.typescriptlang.org/)

---

## What this is

`nexxus-api` is the **runnable API process** for a Nexxus deployment. It's a thin bootstrap around [`@mayhem93/nexxus-api-lib`](https://www.npmjs.com/package/@mayhem93/nexxus-api-lib) — reads a config file, resolves the pluggable services declared in it (logger, database, message queue), wires everything together, and starts the HTTP server.

If [`nexxus-lib`](https://github.com/Mayhem93/nexxus-lib) is the framework, **this is the reference implementation of how you actually run the API tier of a Nexxus deployment**. Custom deployments that need different service wiring can either fork this or write their own bootstrap using the same libraries.

---

## Capabilities

- **REST API for Nexxus**: auth, device management, subscriptions, model CRUD. Full route list lives in the [api-lib README](https://github.com/Mayhem93/nexxus-lib/tree/main/src/api).
- **Pluggable services**: logger, database adapter, and message-queue adapter are chosen at deployment time via the config file. Built-ins ship as static dependencies; anything else is dynamic-imported from the app's `node_modules`.
- **JSON-schema-validated configuration**: the config file is parsed once at startup and validated against the aggregated schemas of every registered service. Bad config = fatal error with a clear message before the server accepts a single request.
- **Graceful shutdown**: `SIGTERM` / `SIGINT` close the HTTP server, the DB connection, the MQ channel, and the Redis client. The event loop drains naturally; no forced exits.

---

## Pluggability

The `app` section of the config file declares which adapter classes to use for logger, DB, and MQ. Two forms are supported:

**Built-in class name** — resolved via direct static import, no I/O:

```json
{
  "app": {
    "logger": "WinstonNexxusLogger",
    "database": "NexxusElasticsearchDb",
    "message_queue": "NexxusRabbitMq"
  }
}
```

**npm package name** — dynamic-imported from the app's `node_modules`. The package must default-export a class extending `NexxusBaseService`:

```json
{
  "app": {
    "logger": "@myorg/nexxus-datadog-logger",
    "database": "@myorg/nexxus-postgres-adapter",
    "message_queue": "NexxusRabbitMq"
  }
}
```

Add the package to your `package.json` dependencies and it just works. The resolver runs a runtime prototype check to make sure the resolved class actually extends `NexxusBaseService` — a clear error surfaces at startup if it doesn't.

Redis is not currently pluggable (there's only one supported client).

---

## Configuration

A minimal `api.conf.json` looks like:

```json
{
  "database": {
    "host": "localhost",
    "port": 9200
  },
  "message_queue": {
    "host": "localhost",
    "port": 5672,
    "user": "guest",
    "password": "guest"
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "cluster": false,
    "password": "1234test"
  },
  "app": {
    "name": "my-nexxus-deployment",
    "port": 5000,
    "logger": "WinstonNexxusLogger",
    "database": "NexxusElasticsearchDb",
    "message_queue": "NexxusRabbitMq",
    "auth": {
      "availableStrategies": ["local", "google"]
    }
  },
  "logger": {
    "level": "info",
    "logType": "json",
    "transports": [
      { "type": "file", "filename": "./logs/api.log", "maxSize": 10485760, "maxFiles": 5 }
    ]
  }
}
```

The file is resolved in this order:

1. Explicit path passed to `NexxusConfigManager`
2. `NXX_CONF_PATH` environment variable
3. `/etc/nexxus/nexxus.conf.json` (the default)

Per-service CLI args and env vars are picked up automatically for anything a registered service declares in its schema (e.g., `NXX_LOG_LEVEL` overrides `logger.level`).

---

## Running

**Prerequisites:**

- Node.js ≥ 24
- Elasticsearch (or your chosen database adapter's backend)
- RabbitMQ (or your chosen message-queue adapter's backend)
- Redis

**Build and start:**

```bash
npm install
npm run build
npm start
```

`npm start` runs `node --enable-source-maps dist/index.js`. The process expects `api.conf.json` in the working directory (or set `NXX_CONF_PATH`).

**Development:** rebuild the lib packages if you're linking sibling directories via `file:` dependencies — the app resolves against the compiled `dist/` output of each lib, not the source.

---

## What's *not* in this repo

- **Framework code**: everything under `NexxusApi`, `NexxusConfigManager`, adapters, models, routes lives in [`nexxus-lib`](https://github.com/Mayhem93/nexxus-lib). This repo just consumes it.
- **Worker processes**: writer, transport manager, and websocket transport each run as separate processes. Each will have its own bootstrap repo (or be spun out from this template).
- **Client SDK**: see the sister [TypeScript client](https://github.com/Mayhem93/nexxus-js-client).

---

## Related

- [`@mayhem93/nexxus-api-lib`](https://www.npmjs.com/package/@mayhem93/nexxus-api-lib) — the actual API framework
- [`@mayhem93/nexxus-core-lib`](https://www.npmjs.com/package/@mayhem93/nexxus-core-lib) — shared types, config manager, base service, logger
- [`@mayhem93/nexxus-database-lib`](https://www.npmjs.com/package/@mayhem93/nexxus-database-lib) — Elasticsearch adapter (built-in DB)
- [`@mayhem93/nexxus-message-queue-lib`](https://www.npmjs.com/package/@mayhem93/nexxus-message-queue-lib) — RabbitMQ adapter (built-in MQ)
- [`@mayhem93/nexxus-redis`](https://www.npmjs.com/package/@mayhem93/nexxus-redis) — Redis client for subscription/device storage

---

## Status

🚧 **Pre-alpha.** The API surface is stabilising alongside the underlying library. Configuration keys and adapter registration patterns may still shift before 1.0.

---

## License

MPL-2.0
