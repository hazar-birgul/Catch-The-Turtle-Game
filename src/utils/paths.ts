/**
 * Deployment path helpers.
 *
 * The game is deployed as a GitHub Pages *project* site, which is served from a
 * repository subpath (`https://<user>.github.io/<repo>/`) rather than the domain
 * root. Local development, meanwhile, runs at `/`.
 *
 * Every URL the game builds at runtime must therefore be resolved against the
 * deployment base rather than assuming `/`. These helpers are the single place
 * that logic lives, so the classic "works locally, 404s on GitHub Pages" failure
 * has exactly one thing to get right.
 */

/**
 * Normalise a base path into the form Vite expects: a single leading slash and a
 * single trailing slash (`/` for the domain root).
 */
export function normalizeBase(base: string): string {
  const trimmed = base.trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  // Preserve absolute URLs (e.g. a CDN origin) apart from the trailing slash.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  const withoutEdgeSlashes = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
  return withoutEdgeSlashes === '' ? '/' : `/${withoutEdgeSlashes}/`;
}

/**
 * Work out the base path a production build should be served from.
 *
 * Resolution order:
 * 1. An explicit `VITE_BASE` environment variable always wins, so any host can be
 *    targeted without code changes.
 * 2. In GitHub Actions, `GITHUB_REPOSITORY` ("owner/repo") gives us the repository
 *    name, so the base is derived rather than hard-coded. A user/organisation site
 *    (`owner.github.io`) is served from the domain root, so it stays `/`.
 * 3. Otherwise `/` — which is what local `vite dev` and `vite preview` need.
 */
export function resolveBase(env: Record<string, string | undefined>): string {
  const explicit = env.VITE_BASE;
  if (explicit !== undefined && explicit.trim() !== '') {
    return normalizeBase(explicit);
  }

  const repository = env.GITHUB_REPOSITORY;
  if (repository?.includes('/')) {
    const repositoryName = repository.split('/')[1];
    if (repositoryName !== undefined && repositoryName !== '') {
      // owner.github.io is a user/org site and is served from the domain root.
      if (repositoryName.toLowerCase().endsWith('.github.io')) {
        return '/';
      }
      return normalizeBase(repositoryName);
    }
  }

  return '/';
}

/**
 * Join a deployment base with a relative asset path.
 *
 * Absolute URLs are returned untouched so externally hosted assets keep working.
 */
export function joinBase(base: string, relativePath: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(relativePath) || relativePath.startsWith('//')) {
    return relativePath;
  }

  const normalizedBase = normalizeBase(base);
  const cleanedPath = relativePath.replace(/^\/+/, '');
  return `${normalizedBase}${cleanedPath}`;
}
