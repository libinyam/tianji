import { vi } from "vitest";

export function createMockDb() {
  const collections: Record<string, Map<string, Record<string, unknown>>> = {};

  const command = {
    inc: vi.fn((n: number) => ({ __inc: n })),
    in: vi.fn((arr: unknown[]) => ({ __in: arr })),
    push: vi.fn((arr: unknown[]) => ({ __push: arr })),
    addToSet: vi.fn((v: unknown) => ({ __addToSet: v })),
  };

  function collection(name: string) {
    if (!collections[name]) collections[name] = new Map();
    const col = collections[name];

    const chainable = {
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ data: Array.from(col.values()) }),
    };

    return {
      ...chainable,
      doc(id: string) {
        return {
          async get() {
            const doc = col.get(id);
            return { data: doc ? [doc] : [] };
          },
          async set(v: Record<string, unknown>) {
            const existed = col.has(id);
            col.set(id, { ...(col.get(id) ?? {}), ...v });
            return existed ? { replaced: 1 } : { upserted: 1 };
          },
          async update(patch: Record<string, unknown>) {
            const cur = (col.get(id) ?? {}) as Record<string, unknown>;
            const next: Record<string, unknown> = { ...cur };
            for (const [k, v] of Object.entries(patch)) {
              if (v && typeof v === "object" && "__inc" in v) {
                next[k] = (next[k] as number ?? 0) + (v as { __inc: number }).__inc;
              } else if (v && typeof v === "object" && "__push" in v) {
                const arr = Array.isArray(next[k]) ? next[k] as unknown[] : [];
                next[k] = arr.concat((v as { __push: unknown[] }).__push);
              } else if (v && typeof v === "object" && "__addToSet" in v) {
                const arr = Array.isArray(next[k]) ? next[k] as unknown[] : [];
                const val = (v as { __addToSet: unknown }).__addToSet;
                if (!arr.includes(val)) arr.push(val);
                next[k] = arr;
              } else {
                next[k] = v;
              }
            }
            col.set(id, next);
            return { updated: 1 };
          },
          async remove() {
            const existed = col.has(id);
            col.delete(id);
            return { deleted: existed ? 1 : 0 };
          },
        };
      },
      async add(v: Record<string, unknown>) {
        const id = `gen_${col.size + 1}_${Date.now()}`;
        col.set(id, { _id: id, ...v });
        return { id };
      },
      where(cond: Record<string, unknown>) {
        const filtered: Record<string, unknown>[] = [];
        for (const [, doc] of col) {
          let match = true;
          for (const [k, v] of Object.entries(cond)) {
            if (v && typeof v === "object" && "__in" in v) {
              if (!(v as { __in: unknown[] }).__in.includes(doc[k])) {
                match = false;
                break;
              }
            } else if (doc[k] !== v) {
              match = false;
              break;
            }
          }
          if (match) filtered.push(doc);
        }
        return {
          ...chainable,
          get: vi.fn().mockResolvedValue({ data: filtered }),
          remove: vi.fn().mockResolvedValue({ deleted: filtered.length }),
        };
      },
    };
  }

  return { collection, command, _collections: collections };
}

export type MockDb = ReturnType<typeof createMockDb>;

export function createMockApp(db: MockDb) {
  return {
    database: () => db,
    callFunction: vi.fn().mockResolvedValue({ result: { ok: true } }),
    auth: () => ({
      getEndUserInfo: vi.fn().mockResolvedValue({ userInfo: { uid: "" } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
      sendPhoneCode: vi.fn(),
      signUpWithPhoneCode: vi.fn(),
      signInWithPhoneCodeOrPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      updateUser: vi.fn(),
    }),
  };
}

export function seedCollection(db: MockDb, name: string, docs: Record<string, unknown>[]) {
  const col = db._collections[name] ?? new Map();
  for (const doc of docs) {
    const id = (doc._id as string) ?? `gen_${col.size + 1}`;
    col.set(id, { ...doc, _id: id });
  }
  db._collections[name] = col;
}
