import type { z } from 'zod';

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error with structured field errors
 */
export class ValidationError extends Error {
  readonly status = 400;
  readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ');
    super(`Validation failed: ${errorMessages}`);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return {
      error: 'Validation failed',
      fieldErrors: this.fieldErrors,
    };
  }
}

/**
 * Parse and validate request body against a Zod schema
 *
 * @throws ValidationError if validation fails
 */
export async function validateBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError({ body: ['Invalid JSON'] });
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'body';
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    throw new ValidationError(fieldErrors);
  }

  return result.data;
}

/**
 * Parse optional body - returns null if no body or parsing fails
 */
export async function parseOptionalBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<z.infer<T> | null> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'query';
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    throw new ValidationError(fieldErrors);
  }

  return result.data;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle route errors consistently
 *
 * @example
 * ```ts
 * try {
 *   // route logic
 * } catch (error) {
 *   return handleRouteError(error, 'approving bounty');
 * }
 * ```
 */
export function handleRouteError(error: unknown, operation: string): Response {
  // Unauthorized from requireAuth()
  if (error instanceof Error && error.message === 'Unauthorized') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validation errors
  if (error instanceof ValidationError) {
    return Response.json(error.toJSON(), { status: 400 });
  }

  // Unexpected errors
  console.error(`Error ${operation}:`, error);
  return Response.json({ error: `Failed to ${operation}` }, { status: 500 });
}

// ============================================================================
// Organization Context
// ============================================================================

export type OrgContext = {
  isOrgContext: boolean;
  orgId: string | null;
};

type Session = {
  user: { id: string };
  session?: { activeOrganizationId?: string | null };
};

/**
 * Get organization context from session
 */
export function getOrgContext(session: Session): OrgContext {
  const orgId = session.session?.activeOrganizationId ?? null;
  return { isOrgContext: !!orgId, orgId };
}

/**
 * Validate that session org context matches resource org context
 *
 * Returns error message if mismatch, null if valid.
 */
export function checkOrgMatch(
  resourceOrgId: string | null | undefined,
  sessionOrgId: string | null | undefined
): string | null {
  const resourceIsOrg = !!resourceOrgId;
  const sessionIsOrg = !!sessionOrgId;

  if (resourceIsOrg && !sessionIsOrg) {
    return 'This is an organization resource. Switch to the organization context.';
  }

  if (!resourceIsOrg && sessionIsOrg) {
    return 'This is a personal resource. Switch to personal mode.';
  }

  if (resourceIsOrg && sessionIsOrg && resourceOrgId !== sessionOrgId) {
    return 'This resource belongs to a different organization.';
  }

  return null;
}
