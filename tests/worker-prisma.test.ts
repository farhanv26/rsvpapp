// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { databaseRequest, requestResource, closeRequestDatabase } from '@/lib/worker-database-lifetime';

describe('Worker database lifetime', () => {
  it('shares within a request, isolates concurrent requests, closes exactly once', async () => {
    const a = {}, b = {}, closeA = vi.fn(async () => {}), closeB = vi.fn(async () => {});
    const first = requestResource(a, () => ({close: closeA}));
    expect(requestResource(a, () => {throw new Error('duplicate pool');})).toBe(first);
    expect(requestResource(b, () => ({close: closeB}))).not.toBe(first);
    await closeRequestDatabase(a); await closeRequestDatabase(a);
    expect(closeA).toHaveBeenCalledTimes(1); expect(closeB).not.toHaveBeenCalled();
    await closeRequestDatabase(b); expect(closeB).toHaveBeenCalledTimes(1);
  });
  it('keeps resources open through streamed rendering, then closes', async () => {
    const context = {}, close = vi.fn(async () => {}), work: Promise<unknown>[] = [];
    requestResource(context, () => ({close}));
    const response = await databaseRequest(context, async () => new Response('rendered'), p => work.push(p));
    expect(close).not.toHaveBeenCalled();
    expect(await response.text()).toBe('rendered'); await Promise.all(work);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('closes on handler failure and stream cancellation', async () => {
    const a = {}, failClose = vi.fn(async () => {});
    requestResource(a, () => ({close: failClose}));
    await expect(databaseRequest(a, async () => {throw new Error('failed');}, () => {})).rejects.toThrow('failed');
    expect(failClose).toHaveBeenCalledTimes(1);
    const b = {}, close = vi.fn(async () => {}), work: Promise<unknown>[] = [];
    requestResource(b, () => ({close}));
    const response = await databaseRequest(b, async () => new Response(new ReadableStream()), p => work.push(p));
    await response.body!.cancel(); await Promise.all(work); expect(close).toHaveBeenCalledTimes(1);
  });
  it('waits for request background work before disposal', async () => {
    const context = {}, close = vi.fn(async () => {}), work: Promise<unknown>[] = [];
    let release!: () => void;
    const background = new Promise<void>(resolve => {release = resolve;});
    requestResource(context, () => ({close}));
    const response = await databaseRequest(context, async () => new Response('done'), p => work.push(p), () => background);
    await response.text(); expect(close).not.toHaveBeenCalled();
    release(); await Promise.all(work); expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('retry safety', () => {
  it('never repeats a possibly committed write after a connection error', async () => {
    const { withReconnect } = await import('@/lib/prisma');
    const write = vi.fn(async () => {throw new Error('ECONNRESET after commit');});
    await expect(withReconnect(write)).rejects.toThrow('ECONNRESET');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
