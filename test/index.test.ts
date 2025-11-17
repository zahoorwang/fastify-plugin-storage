import fastify from 'fastify';
import memory from 'unstorage/drivers/memory';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { fastifyStorage } from '../src/index';

import type { FastifyInstance } from 'fastify';

import type { FastifyStorageOptions } from '../src/index';

async function setupServe(options: Partial<FastifyStorageOptions> = {}, handlePreReady?: (instance: FastifyInstance) => void | Promise<void>): Promise<FastifyInstance> {
  const instance = fastify();
  await instance.register(fastifyStorage, { driver: memory(), ...options } as any);
  await handlePreReady?.(instance);
  await instance.ready();
  return instance;
}

describe('@zahoor/fastify-storage', () => {
  let serve: FastifyInstance;
  const closeSpied = vi.fn();

  beforeAll(async () => {
    serve = await setupServe(
      {
        close: closeSpied
      },
      async instance => {
        // Register a temporary route for request hookable testing
        instance.get('/test-storage', async req => {
          expect(req.storage).toBeDefined();
          expect(req.storagePrefix).toBeDefined();
          expect(req.storageSnapshot).toBeDefined();
          return { ok: true };
        });
      }
    );
  });

  afterAll(async () => {
    await serve.close();
  });

  // --------------------------------------------
  // Decorators
  // --------------------------------------------

  it('should decorate Fastify instance with storage, storagePrefix, storageSnapshot', () => {
    expect(serve.storage).toBeDefined();
    expect(serve.storagePrefix).toBeDefined();
    expect(serve.storageSnapshot).toBeDefined();
  });

  it('should decorate Fastify request with same APIs', async () => {
    const res = await serve.inject({ method: 'GET', url: '/test-storage' });
    expect(res.statusCode).toBe(200);
  });

  // --------------------------------------------
  // storagePrefix tests
  // --------------------------------------------

  it('should correctly namespace keys using storagePrefix', async () => {
    const users = serve.storagePrefix('users:');

    await users.setItem('u1', { name: 'Alice' });

    const raw = await serve.storage.getItem('users:u1');
    expect(raw).toEqual({ name: 'Alice' });
  });

  // --------------------------------------------
  // snapshot tests
  // --------------------------------------------

  it('should correctly take and restore snapshots', async () => {
    await serve.storage.setItem('foo', 'original');

    const snap = await serve.storageSnapshot('');
    expect(snap).toBeDefined();

    // modify key
    await serve.storage.setItem('foo', 'changed');

    // restore snapshot
    await serve.storageSnapshot.restore(snap);

    const restored = await serve.storage.getItem('foo');
    expect(restored).toBe('original');
  });

  // --------------------------------------------
  // close hook tests
  // --------------------------------------------

  it('should call close hook on server shutdown', async () => {
    const closeSpied = vi.fn();

    const fastifyClose = await setupServe({ close: closeSpied });
    await fastifyClose.close();
    expect(closeSpied).toHaveBeenCalled();
  });
});
