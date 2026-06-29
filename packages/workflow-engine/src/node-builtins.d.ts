declare module "node:fs/promises" {
  export function mkdir(
    path: string,
    options: { recursive: true }
  ): Promise<string | undefined>;
  export function readdir(path: string): Promise<string[]>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function writeFile(
    path: string,
    data: string,
    encoding: "utf8"
  ): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}
