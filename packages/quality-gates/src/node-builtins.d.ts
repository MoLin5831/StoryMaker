declare module "node:fs/promises" {
  export function mkdir(
    path: string,
    options?: {
      recursive?: boolean;
    }
  ): Promise<string | undefined>;
  export function writeFile(
    path: string,
    data: string,
    encoding?: string
  ): Promise<void>;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}
