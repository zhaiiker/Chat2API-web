/**
 * Tiny JSON-file-backed key-value store.
 *
 * This is a CommonJS-friendly drop-in for the very small subset of the
 * `conf` package that Chat2API actually uses (`get`, `set`, `clear`).
 * It exists because `conf` is pure ESM since v11 and our backend is
 * compiled to CommonJS, which means `require('conf')` blows up at
 * runtime under ts-node and after `tsc`.
 *
 * Behaviour worth knowing:
 *
 *  - The whole file is loaded into memory on construction (with the
 *    schema's `defaults` filled in for any missing top-level keys) and
 *    persisted synchronously on every `set`/`clear`. That matches the
 *    original `conf` semantics closely enough for our small dataset.
 *
 *  - Writes go through a `fileName.tmp` file followed by `rename`, so a
 *    crashed process can never leave behind a half-written JSON.
 *
 *  - If the file is missing or unparsable we throw, and the caller
 *    (storeManager) already has a "back up the broken file and start
 *    fresh" recovery path that handles that case.
 */

import * as fs from 'fs'
import * as path from 'path'

export interface JsonStoreOptions<T> {
  /** Directory the data file lives in. Created if missing. */
  cwd: string
  /** File basename, no extension. Defaults to `config`. */
  configName?: string
  /** Default values, merged on top-level keys when keys are missing. */
  defaults?: T
}

export class JsonStore<T extends object = Record<string, unknown>> {
  readonly path: string
  private data: Record<string, unknown>

  constructor(options: JsonStoreOptions<T>) {
    const fileName = `${options.configName ?? 'config'}.json`
    this.path = path.join(options.cwd, fileName)

    if (!fs.existsSync(options.cwd)) {
      fs.mkdirSync(options.cwd, { recursive: true })
    }

    this.data = this.load((options.defaults ?? {}) as Record<string, unknown>)
  }

  private load(defaults: Record<string, unknown>): Record<string, unknown> {
    if (!fs.existsSync(this.path)) {
      const initial = { ...defaults }
      this.persist(initial)
      return initial
    }

    const raw = fs.readFileSync(this.path, 'utf8')
    if (!raw.trim()) {
      const initial = { ...defaults }
      this.persist(initial)
      return initial
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to parse store file ${this.path}: ${message}`)
    }

    // Top-level merge with defaults so newly added schema keys appear
    // automatically without forcing a migration step.
    return { ...defaults, ...parsed }
  }

  private persist(snapshot: Record<string, unknown>): void {
    const tmp = `${this.path}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8')
    fs.renameSync(tmp, this.path)
  }

  get<K extends keyof T>(key: K): T[K]
  get(key: string): unknown
  get(key: string): unknown {
    return this.data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void
  set(key: string, value: unknown): void
  set(key: string, value: unknown): void {
    this.data[key] = value
    this.persist(this.data)
  }

  clear(): void {
    this.data = {}
    this.persist(this.data)
  }
}

export default JsonStore
