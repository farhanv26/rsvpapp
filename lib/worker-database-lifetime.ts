// Registry shared by the generated Next bundle and the custom Worker entry bundle.
// Only the registry is isolate-wide; clients/sockets belong to one request context.
type Resource = { close: () => Promise<void> };
const key = Symbol.for('vowpal.request-database-resources');
const shared = globalThis as typeof globalThis & { [key]?: WeakMap<object, Resource> };
const resources = shared[key] ??= new WeakMap<object, Resource>();

export function requestResource<T extends Resource>(context: object, create: () => T): T {
  let resource = resources.get(context);
  if (!resource) { resource = create(); resources.set(context, resource); }
  return resource as T;
}

export async function closeRequestDatabase(context: object) {
  const resource = resources.get(context);
  if (resource) { resources.delete(context); await resource.close(); }
}

// Await streamed rendering as well as ordinary responses before closing the pool.
export async function databaseRequest(
  context: object, handle: () => Promise<Response>, waitUntil: (work: Promise<unknown>) => void,
  drainBackground: () => Promise<void> = async () => {},
) {
  const finish = async () => { await drainBackground(); await closeRequestDatabase(context); };
  try {
    const response = await handle();
    if (!response.body) { await finish(); return response; }
    const stream = new TransformStream();
    const complete = response.body.pipeTo(stream.writable)
      .finally(finish);
    // Never log driver errors, which may contain SQL or connection details.
    waitUntil(complete.catch(() => undefined));
    return new Response(stream.readable, response);
  } catch (error) {
    await finish();
    throw error;
  }
}
