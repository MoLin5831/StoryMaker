declare module "node:fs/promises" {
  export function mkdir(
    path: string,
    options?: {
      recursive?: boolean;
    }
  ): Promise<string | undefined>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function readdir(path: string): Promise<string[]>;
  export function writeFile(
    path: string,
    data: string,
    encoding?: string
  ): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}
