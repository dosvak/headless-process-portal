/** Classic REST API serialization -> plain JSON: lists arrive as {selected, items}, business objects carry @metadata. */
export function plain<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map(plain) as T;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o['items']) && 'selected' in o && Object.keys(o).length <= 3) return (o['items'] as unknown[]).map(plain) as T;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) if (k !== '@metadata') out[k] = plain(x);
    return out as T;
  }
  return v as T;
}
