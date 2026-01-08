/**
 * Route context types for Next.js App Router API routes.
 *
 * Next.js generates these types during build, but we define them
 * globally for better IDE support and typecheck without build.
 */

type ExtractParams<T extends string> = T extends `${string}[${infer Param}]${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : Record<string, never>;

declare global {
  type RouteContext<T extends string> = {
    params: Promise<ExtractParams<T>>;
  };
}

export {};
