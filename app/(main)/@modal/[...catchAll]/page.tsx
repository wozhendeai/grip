/**
 * Catch-all route for modal parallel slot
 *
 * Returns null to clear the modal when navigating to any route
 * that doesn't have a specific intercepting route defined.
 *
 * Without this, the @modal slot persists on soft navigation because
 * Next.js parallel routes are independent render trees that don't
 * automatically clear when the URL changes.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes
 */
export default function CatchAll() {
  return null;
}
