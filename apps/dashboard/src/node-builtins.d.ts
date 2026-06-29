declare module "node:crypto" {
  export function randomBytes(size: number): {
    toString(encoding: "base64url"): string;
  };
}

declare module "node:fs/promises" {
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
}

declare module "node:http" {
  export type IncomingMessage = {
    method?: string;
    on(event: "data", listener: (chunk: unknown) => void): IncomingMessage;
    on(event: "end", listener: () => void): IncomingMessage;
    on(event: "error", listener: (error: Error) => void): IncomingMessage;
    url?: string;
  };

  export type ServerResponse = {
    end(chunk?: string): void;
    setHeader(name: string, value: string): void;
    statusCode: number;
  };

  export type Server = {
    address(): null | string | { address: string; family: string; port: number };
    close(callback?: (error?: Error) => void): Server;
    listen(port: number, host: string, callback?: () => void): Server;
    once(event: "error", listener: (error: Error) => void): Server;
  };

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  ): Server;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:url" {
  export class URLSearchParams {
    constructor(init?: string);
    get(name: string): string | null;
  }
}
