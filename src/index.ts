import fp from 'fastify-plugin';
import { createStorage, defineDriver, prefixStorage, snapshot, restoreSnapshot } from 'unstorage';

import type { FastifyPluginCallback } from 'fastify';
import type { CreateStorageOptions, Snapshot, Storage } from 'unstorage';

export { defineDriver };

// -------------------------------------------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------------------------------------------

/**
 * Configuration options for the `fastifyStorage` plugin.
 *
 * Extends `unstorage`'s `CreateStorageOptions` with an optional `close` callback,
 * which is executed when the Fastify server is shutting down.
 */
export interface FastifyStorageOptions extends CreateStorageOptions {
  /**
   * Called when the `Fastify` server is closing.
   * Useful for stopping watchers and disposing mounted storages to prevent open handles.
   */
  close?: () => void | Promise<void>;
}

/**
 * Internal plugin type signature used by Fastify.
 * @internal
 */
type FastifyStoragePlugin = FastifyPluginCallback<NonNullable<FastifyStorageOptions>>;

/**
 * Represents a snapshot tool for storage, combining:
 * - a callable function to take a snapshot
 * - a `restore` method to restore a snapshot
 * @internal
 */
type StorageSnapshotReturn = {
  /**
   * Take a snapshot of the current storage state for the given base/prefix.
   * @param base The base or prefix to snapshot
   * @returns A promise resolving to the snapshot data
   */
  (base: string): Promise<Snapshot>;

  /**
   * Restore storage state from a previously taken snapshot.
   * @param snapshot The snapshot data to restore
   * @param base Optional base/prefix to restore into
   */
  restore(snapshot: Snapshot, base?: string): Promise<void>;
};

// -------------------------------------------------------------------------------------------------
// Internal Utilities
// -------------------------------------------------------------------------------------------------

/**
 * Creates a prefixed storage factory.
 * @param storage The storage instance to prefix
 * @returns A function that takes a prefix and returns a prefixed Storage instance
 * @internal
 */
function createPrefixedStorage(storage: Storage) {
  return (prefix: string) => {
    return prefixStorage(storage, prefix);
  };
}

/**
 * Creates a snapshoted storage instance.
 * Provides a callable function to take snapshots and a restore method to restore them.
 * @param storage The storage instance
 * @internal
 */
function createSnapshotedStorage(storage: Storage): StorageSnapshotReturn {
  const fn = ((base: string) => snapshot(storage, base)) as StorageSnapshotReturn;
  fn.restore = (snapshot: Snapshot, base?: string) => restoreSnapshot(storage, snapshot, base);
  return fn;
}

// -------------------------------------------------------------------------------------------------
// Fastify Plugin Implementation
// -------------------------------------------------------------------------------------------------

/**
 * Fastify plugin integrating `unstorage` into Fastify.
 *
 * Provides:
 * - `fastify.storage` and `req.storage` for the base storage instance
 * - `fastify.storagePrefix` and `req.storagePrefix` for prefixed storage
 * - `fastify.storageSnapshot` and `req.storageSnapshot` for snapshot/restore
 *
 * Handles storage cleanup on server shutdown, invoking optional `close` callback.
 */
const plugin: FastifyStoragePlugin = (fastify, opts, done) => {
  const storage = createStorage(opts);

  // Storage - base instance
  fastify.decorate('storage', { getter: () => storage });
  fastify.decorateRequest('storage', { getter: () => storage });

  // Storage Prefix factory
  const storagePrefix = createPrefixedStorage(storage);
  fastify.decorate('storagePrefix', storagePrefix);
  fastify.decorateRequest('storagePrefix', storagePrefix);

  // Snapshot / Restore
  const storageSnapshot = createSnapshotedStorage(storage);
  fastify.decorate('storageSnapshot', storageSnapshot);
  fastify.decorateRequest('storageSnapshot', storageSnapshot);

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    try {
      await opts.close?.();
    } finally {
      await storage.unwatch();

      const mounts = storage.getMounts('');
      for (const { base } of mounts) {
        await storage.unmount(base, true);
      }

      await storage.dispose();
    }
  });

  done();
};

export const fastifyStorage = fp(plugin, {
  fastify: '5.x',
  name: '@zahoor/fastify-storage'
});

export default fastifyStorage;

// -------------------------------------------------------------------------------------------------
// Fastify Type Augmentation
// -------------------------------------------------------------------------------------------------

/**
 * Extends the built-in Fastify type definitions to include
 * `storage`, `storagePrefix`, and `storageSnapshot` on both
 * `FastifyInstance` and `FastifyRequest`.
 *
 * This provides type-safe access to the shared `unstorage` storage
 * system throughout your Fastify application — allowing plugins,
 * routes, and requests to read/write data, create prefixed storages,
 * and manage snapshots.
 *
 * For example:
 * ```ts
 * // Access base storage
 * await fastify.storage.setItem('key', { foo: 123 });
 *
 * // Use prefixed storage
 * const userStore = req.storagePrefix('users:');
 * await userStore.setItem('u1', { name: 'Alice' });
 *
 * // Take a snapshot
 * const snap = await req.storageSnapshot('users:');
 *
 * // Restore a snapshot
 * await req.storageSnapshot.restore(snap, 'users:');
 * ```
 *
 * The `storageSnapshot` type is derived from an internal factory
 * that provides a function to create snapshots and a `restore` method
 * for restoring them.
 */
declare module 'fastify' {
  interface FastifyInstance {
    /**
     * The base `Storage` instance shared across the Fastify server.
     * Allows storing, retrieving, and deleting key-value pairs.
     */
    storage: Storage;

    /**
     * A factory function to create prefixed storage instances.
     * Useful for namespacing keys to avoid collisions.
     *
     * @param prefix A string prefix to apply to all keys in the storage.
     * @returns A new `Storage` instance scoped to the given prefix.
     */
    storagePrefix(prefix: string): Storage;

    /**
     * Snapshot for storage.
     * Provides a callable function to create snapshots and a `restore` method to restore them.
     */
    storageSnapshot: StorageSnapshotReturn;
  }

  interface FastifyRequest {
    /**
     * The base `Storage` instance shared across the Fastify server.
     * Allows storing, retrieving, and deleting key-value pairs.
     */
    storage: Storage;

    /**
     * A factory function to create prefixed storage instances.
     * Useful for namespacing keys to avoid collisions.
     *
     * @param prefix A string prefix to apply to all keys in the storage.
     * @returns A new `Storage` instance scoped to the given prefix.
     */
    storagePrefix(prefix: string): Storage;

    /**
     * Snapshot for storage.
     * Provides a callable function to create snapshots and a `restore` method to restore them.
     */
    storageSnapshot: StorageSnapshotReturn;
  }
}
