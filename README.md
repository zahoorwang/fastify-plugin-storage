# @zahoor/fastify-storage

[![NPM version](https://img.shields.io/npm/v/@zahoor/fastify-storage?style=for-the-badge)](https://www.npmjs.com/package/@zahoor/fastify-storage)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen?style=for-the-badge)]()

> **The current version does not work; DO NOT USE.**

A Fastify plugin integrating [Unstorage](https://unstorage.unjs.io), providing base storage, prefixed storage, and snapshot/restore utilities with automatic cleanup on server shutdown.

## Features

- Base storage access (`fastify.storage` / `req.storage`)
- Prefixed storage factory (`fastify.storagePrefix(prefix)` / `req.storagePrefix(prefix)`)
- Snapshot and restore storage (`fastify.storageSnapshot(base)` / `req.storageSnapshot(base)`)
- Automatic cleanup of mounted storages on server shutdown
- Optional `close` callback to perform custom cleanup logic
- TypeScript ready with type-safe access

## Install

```sh
npm i @zahoor/fastify-storage
```

### Compatibility

| Plugin version | Fastify version | Unstorage version |
| -------------- | --------------- | ----------------- |
| `current`      | `^5.x`          | `^1.x`            |

## Usage

```ts
import Fastify from 'fastify';
import { fastifyStorage } from '@zahoor/fastify-storage';
import memory from '@zahoor/fastify-storage/drivers/memory';

const fastify = Fastify();

fastify.register(fastifyStorage, {
  // Optional Unstorage options
  driver: memory(),
  close: async () => {
    console.log('Server is closing, custom cleanup logic here');
  }
});

fastify.get('/test', async (req, reply) => {
  // Base storage
  await req.storage.setItem('foo', { bar: 123 });
  const value = await req.storage.getItem('foo');

  // Prefixed storage
  const userStore = req.storagePrefix('users:');
  await userStore.setItem('u1', { name: 'Alice' });
  const user = await userStore.getItem('u1');

  // Take a snapshot
  const snap = await req.storageSnapshot('users:');

  // Restore a snapshot
  await req.storageSnapshot.restore(snap, 'users:');

  return { value, user };
});

fastify.listen({ port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
});
```

## API

### FastifyInstance & FastifyRequest

- **`storage`** (`Storage`)
  The base storage instance. Allows storing, retrieving, and deleting key-value pairs.

- **`storagePrefix(prefix: string)`** (`Storage`)
  Factory function to create prefixed storage instances. Useful for namespacing keys to avoid collisions.

  - `prefix`: A string prefix applied to all keys in the storage.

- **`storageSnapshot(base: string)`** (`Promise<Snapshot>`)
  Function to take a snapshot of the current storage state.

  - `base`: The base or prefix to snapshot.

- **`storageSnapshot.restore(snapshot: Snapshot, base?: string)`** (`Promise<void>`)
  Restore storage state from a previously taken snapshot.

  - `snapshot`: The snapshot data to restore.
  - `base` (optional): The base or prefix to restore into.

## Options

The plugin accepts all **Unstorage options** via **CreateStorageOptions**, plus an optional **close** callback.

- **close**: Called when the Fastify server is closing. Useful for stopping watchers or cleaning up mounted storages.

## License

Licensed under [MIT](./LICENSE).
