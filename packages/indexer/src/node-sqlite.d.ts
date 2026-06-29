declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
    run(...values: unknown[]): unknown;
  }
}

declare module "node:fs/promises" {
  export type Dirent = {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  };

  export function access(path: string): Promise<void>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function readdir(
    path: string,
    options: { withFileTypes: true }
  ): Promise<Dirent[]>;
}

declare module "node:path" {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}
