export const CREW_STATIONS = [[-4, 1], [-3.6, -1.8], [-3.6, -4.3], [3.6, -4.3], [3.6, -1.8], [4, 1]] as const;
export type RoomPoint = { x: number; z: number };
export function roomBlocked(x: number, z: number, playerSeat: number) {
  return x < -6.3 || x > 6.3 || z < -5.5 || z > 6.3
    || (Math.abs(x) < 1.65 && Math.abs(z + 1.8) < 1.85)
    || CREW_STATIONS.some(([sx,sz])=>Math.abs(x-sx)<.55 && Math.abs(z-(sz-.9))<.4)
    || CREW_STATIONS.some(([sx, sz], i) => i !== playerSeat && Math.hypot(x - sx, z - sz) < .7);
}
// A small four-neighbour grid keeps click paths outside the rover bay, consoles, and crew colliders.
export function roomPath(start: RoomPoint, target: RoomPoint, seat: number): RoomPoint[] {
  const cols = 25, rows = 24, step = .5;
  const point = (i: number) => ({ x: -6 + (i % cols) * step, z: -5.25 + Math.floor(i / cols) * step });
  const free = (i: number) => { const p = point(i); return !roomBlocked(p.x, p.z, seat); };
  const nearest = (p: RoomPoint) => {
    let best = 0, distance = Infinity;
    for (let i = 0; i < cols * rows; i++) {
      if (!free(i)) continue;
      const q = point(i), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < distance) { best = i; distance = d; }
    }
    return best;
  };
  const from = nearest(start), to = nearest(target), queue = [from], parents = new Map<number, number>([[from, -1]]);
  for (let head = 0; head < queue.length && !parents.has(to); head++) {
    const current = queue[head], x = current % cols, z = Math.floor(current / cols);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, nz = z + dz, next = nz * cols + nx;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || parents.has(next) || !free(next)) continue;
      parents.set(next, current); queue.push(next);
    }
  }
  if (!parents.has(to)) return [];
  const path: RoomPoint[] = [];
  for (let i = to; i !== from; i = parents.get(i)!) path.unshift(point(i));
  return path;
}
