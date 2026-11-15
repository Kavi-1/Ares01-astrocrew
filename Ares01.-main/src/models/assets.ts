import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Texture, type Mesh, type Object3D, type Skeleton } from 'three';

export const MODEL_PATHS = {
  rover: '/models/rover.glb',
  crew: (id: string) => `/models/crew/${id}.glb`,
};

export type ModelProgress = {
  phase: 'waiting' | 'downloading' | 'preparing' | 'ready' | 'failed';
  loadedBytes?: number;
  totalBytes?: number;
  error?: string;
};
export type ModelLoadOptions = { signal?: AbortSignal; onProgress?: (progress: ModelProgress) => void };
const aborted = () => new DOMException('Model load cancelled.', 'AbortError');
export function isModelAbort(error: unknown) { return error instanceof Error && error.name === 'AbortError'; }
export function modelFailure(error: unknown): ModelProgress {
  return { phase: 'failed', error: error instanceof Error ? error.message : String(error) };
}
export function modelProgressText(progress: ModelProgress, name: string) {
  switch (progress.phase) {
    case 'waiting': return `Waiting for ${name}…`;
    case 'downloading': {
      const loaded = progress.loadedBytes ?? 0, total = progress.totalBytes;
      const amount = total ? `${Math.min(100, Math.floor(loaded / total * 100))}%` : `${(loaded / 1_000_000).toFixed(1)} MB`;
      return `Downloading ${name} · ${amount}`;
    }
    case 'preparing': return `Preparing ${name}…`;
    case 'ready': return `${name} ready`;
    case 'failed': return `${name} unavailable · You can retry`;
  }
}

type Download = {
  controller: AbortController;
  listeners: Set<(progress: ModelProgress) => void>;
  users: number;
  progress: ModelProgress;
  promise: Promise<ArrayBuffer>;
};
type DownloadSettings = {
  fetch?: typeof fetch;
  stallMs?: number;
  maxEntries?: number;
  maxBytes?: number;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

// In-flight requests are reference counted separately from the completed LRU.
// Only bytes are shared. Parsed scenes, textures and skeletons stay consumer-owned.
export class ModelDownloads {
  private active = new Map<string, Download>();
  private cached = new Map<string, ArrayBuffer>();
  private cachedBytes = 0;
  private settings: Required<DownloadSettings>;
  constructor(settings: DownloadSettings = {}) {
    this.settings = { fetch: (...args) => fetch(...args), stallMs: 30_000, maxEntries: 3,
      maxBytes: 40 * 1024 * 1024, setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: timer => clearTimeout(timer), ...settings };
  }
  get stats() { return { active: this.active.size, entries: this.cached.size, bytes: this.cachedBytes }; }
  forget(url: string, bytes: ArrayBuffer) {
    if (this.cached.get(url) === bytes) { this.cached.delete(url); this.cachedBytes -= bytes.byteLength; }
  }
  private remember(url: string, bytes: ArrayBuffer) {
    if (bytes.byteLength > this.settings.maxBytes) return;
    const previous = this.cached.get(url);
    if (previous) this.forget(url, previous);
    this.cached.set(url, bytes); this.cachedBytes += bytes.byteLength;
    while (this.cached.size > this.settings.maxEntries || this.cachedBytes > this.settings.maxBytes) {
      const oldest = this.cached.keys().next().value!;
      this.forget(oldest, this.cached.get(oldest)!);
    }
  }
  private async transfer(url: string, entry: Download) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stalled = false;
    const resetDeadline = () => {
      if (timer !== undefined) this.settings.clearTimer(timer);
      timer = this.settings.setTimer(() => { stalled = true; entry.controller.abort(); }, this.settings.stallMs);
    };
    const publish = (progress: ModelProgress) => {
      entry.progress = progress;
      for (const listener of entry.listeners) listener(progress);
    };
    resetDeadline(); // Also bound waiting for response headers / the first byte.
    try {
      const response = await this.settings.fetch(url, { signal: entry.controller.signal });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status} ${response.statusText}`.trim()); }
      if (!response.body) throw new Error('Response has no model body.');
      const declared = Number(response.headers.get('content-length'));
      // Encoded Content-Length may describe compressed wire bytes, not read() bytes.
      const encoding = response.headers.get('content-encoding');
      const totalBytes = (!encoding || encoding === 'identity') && Number.isSafeInteger(declared) && declared > 0 ? declared : undefined;
      let loadedBytes = 0, lastBucket = -1, lastPublishedAt = -Infinity;
      publish({ phase: 'downloading', loadedBytes, totalBytes });
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (entry.controller.signal.aborted) throw aborted();
          if (done) break;
          if (value.byteLength) {
            chunks.push(value); loadedBytes += value.byteLength; resetDeadline();
            const knownTotal = totalBytes && loadedBytes <= totalBytes ? totalBytes : undefined;
            const bucket = Math.floor(knownTotal ? loadedBytes / knownTotal * 100 : loadedBytes / 100_000);
            const now = performance.now();
            if (bucket !== lastBucket && (now - lastPublishedAt >= 100 || loadedBytes === totalBytes)) {
              lastBucket = bucket; lastPublishedAt = now;
              publish({ phase: 'downloading', loadedBytes, totalBytes: knownTotal });
            }
          }
        }
      } finally {
        // Fetch abort cancels the underlying network; release the reader on every path.
        if (entry.controller.signal.aborted) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (!loadedBytes) throw new Error('Empty model response.');
      if (totalBytes && loadedBytes !== totalBytes) throw new Error(`Incomplete model response: ${loadedBytes}/${totalBytes} bytes.`);
      const bytes = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      if (!entry.controller.signal.aborted && this.active.get(url) === entry) this.remember(url, bytes.buffer);
      return bytes.buffer;
    } catch (error) {
      if (stalled) throw new Error(`Model download stalled: ${url}; no data for ${this.settings.stallMs / 1000}s. Retry is available.`, { cause: error });
      if (entry.controller.signal.aborted) throw aborted();
      throw new Error(`Model download failed: ${url}; ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    } finally {
      if (timer !== undefined) this.settings.clearTimer(timer);
      if (this.active.get(url) === entry) this.active.delete(url);
    }
  }
  async get(url: string, { signal, onProgress }: ModelLoadOptions = {}): Promise<ArrayBuffer> {
    signal?.throwIfAborted();
    const cached = this.cached.get(url);
    if (cached) { this.cached.delete(url); this.cached.set(url, cached); return cached; }
    let entry = this.active.get(url);
    if (!entry) {
      entry = { controller: new AbortController(), listeners: new Set(), users: 0,
        progress: { phase: 'downloading', loadedBytes: 0 }, promise: undefined! };
      this.active.set(url, entry);
      entry.promise = this.transfer(url, entry);
    }
    const request = entry;
    request.users++;
    if (onProgress) { request.listeners.add(onProgress); onProgress(request.progress); }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true; signal?.removeEventListener('abort', cancel);
        if (onProgress) request.listeners.delete(onProgress);
        request.users--;
        if (!request.users && this.active.get(url) === request) {
          this.active.delete(url); request.controller.abort();
        }
        action();
      };
      const cancel = () => finish(() => reject(aborted()));
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
      request.promise.then(bytes => finish(() => resolve(bytes)), error => finish(() => reject(error)));
    });
  }
}

const downloads = new ModelDownloads();
export const modelDownloadStats = () => downloads.stats;

export async function loadModel(url: string, options: ModelLoadOptions = {}) {
  const { signal, onProgress } = options;
  let bytes: ArrayBuffer | undefined;
  try {
    signal?.throwIfAborted();
    onProgress?.({ phase: 'waiting' });
    bytes = await downloads.get(url, options);
    signal?.throwIfAborted();
    onProgress?.({ phase: 'preparing' });
    // parseAsync yields during image decoding; do not add an extra scene-render turn.
    const parsing = new GLTFLoader().parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1));
    // GLTFLoader cannot cancel parsing. Release a late result instead of applying it.
    return await new Promise<Awaited<typeof parsing>>((resolve, reject) => {
      const cancel = () => reject(aborted());
      signal?.addEventListener('abort', cancel, { once: true });
      parsing.then(gltf => {
        signal?.removeEventListener('abort', cancel);
        if (signal?.aborted) { disposeModelScenes(gltf.scenes); reject(aborted()); }
        else resolve(gltf);
      }, error => { signal?.removeEventListener('abort', cancel); reject(error); });
      if (signal?.aborted) cancel();
    });
  } catch (error) {
    if (signal?.aborted || isModelAbort(error)) throw aborted();
    if (bytes) downloads.forget(url, bytes); // Malformed bytes must not poison retry.
    const failure = new Error(`Unable to prepare model ${url}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    onProgress?.(modelFailure(failure));
    throw failure;
  }
}

function disposeModelScenes(roots: Object3D[]) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<import('three').Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  for (const root of roots) root.traverse(object => {
    const renderable = object as Mesh;
    if (!renderable.geometry || !renderable.material) return;
    geometries.add(renderable.geometry);
    for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
    if ('skeleton' in object) skeletons.add((object as import('three').SkinnedMesh).skeleton);
  });
  skeletons.forEach(skeleton => skeleton.dispose());
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  const bitmaps = new Set<ImageBitmap>();
  textures.forEach(texture => {
    texture.dispose();
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
  });
  bitmaps.forEach(bitmap => bitmap.close());
}
export function disposeModel(root: Object3D) { disposeModelScenes([root]); }
