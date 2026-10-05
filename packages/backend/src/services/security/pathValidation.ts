import path from "node:path";

export class PathAccessDeniedError extends Error {
  constructor(requestedPath: string) {
    super(`Path "${requestedPath}" is outside all configured workspace roots.`);
    this.name = "PathAccessDeniedError";
  }
}

/**
 * Resolves `requestedPath` (absolute or relative to the first workspace root)
 * and verifies the resolved path is contained within one of the configured
 * workspace roots. Throws PathAccessDeniedError otherwise.
 */
export function resolveWorkspacePath(workspaceRoots: string[], requestedPath: string): string {
  const normalizedRoots = workspaceRoots.map((r) => path.resolve(r));
  const base = normalizedRoots[0] ?? process.cwd();
  const resolved = path.isAbsolute(requestedPath) ? path.resolve(requestedPath) : path.resolve(base, requestedPath);

  const isInside = normalizedRoots.some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });

  if (!isInside) {
    throw new PathAccessDeniedError(requestedPath);
  }
  return resolved;
}

export function isWithinWorkspace(workspaceRoots: string[], candidatePath: string): boolean {
  try {
    resolveWorkspacePath(workspaceRoots, candidatePath);
    return true;
  } catch {
    return false;
  }
}
