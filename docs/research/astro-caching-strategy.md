# Astro Build Caching Strategy — Research & Recommendations

## Current State of the Project

- **Astro version**: `^5.6.1` (with Starlight `^0.37.6`)
- **Content files**: ~1,398 Markdown/MDX documents
- **Package manager**: pnpm 10.30.0
- **CI workflow**: GitHub Actions using `withastro/action@v3`, deploying to GitHub Pages
- **Search**: Starlight's built-in Pagefind integration

---

## Problem 1: Incremental Content Caching

### What changed in Astro 5.x

The `experimental.contentCollectionCache` flag from Astro 3.5–4.x **was removed entirely in Astro 5.0**. It had known bugs (stale content, empty collections, import errors) and was superseded by the new **Content Layer API**, which has caching built in.

The Content Layer stores collection data in `node_modules/.astro/data-store.json`. For file-based content (Markdown/MDX loaded via the default glob loader), this cache persists parsed content between builds automatically — **no config flag needed**.

Key details of the built-in caching:
- **Object loaders** (used by `glob()` for file-based content) support incremental updates via a `meta` store for sync tokens and timestamps.
- **Inline loaders** (simple array-returning functions) do NOT get incremental caching — the store is cleared each run.
- The cache invalidates when the content config, Astro version, or relevant Astro config changes.
- Astro claims up to **5x faster Markdown builds** and **2x faster MDX** with the content layer vs. legacy collections.

### The honest limitation (still applies)

Even with content layer caching, Astro still performs a **full route generation and HTML render pass** every build. There is no "only emit these 12 pages" mode. The savings come from skipping re-parsing unchanged documents through the remark/rehype pipeline — which for ~1,400 documents is still substantial (likely 40–60% of build time).

### What `withastro/action` already does

The project uses `withastro/action@v3`, but the **current version is v5** (v5.2.0). Upgrading is recommended.

The action already:
1. Detects pnpm from the lockfile and sets it up
2. Sets up Node.js (defaults to Node 22)
3. Installs dependencies
4. **Restores `.astro/` build cache** via `actions/cache/restore` (enabled by default)
5. Runs the Astro build
6. **Saves `.astro/` build cache** via `actions/cache/save`
7. Uploads the Pages artifact

So the **`.astro/` content layer cache is already handled by the action** — the data-store.json with parsed content, optimized images, and other build artifacts are persisted between CI runs automatically.

### What the action does NOT cache

| Item | Cached? | Impact |
|---|---|---|
| `.astro/` build cache | Yes (by default) | Content layer data, optimized images |
| Package manager store | Partially (via setup-node) | Cached tarballs, not node_modules |
| `node_modules/` | No | Fresh install every build |
| `dist/` output | No | Full rebuild of HTML output |

---

## Problem 2: Caching the Search Index (Pagefind)

### Pagefind does NOT support incremental indexing

This has been discussed on the Pagefind repository (Discussion #831). The maintainer explained why:

1. **Index architecture opposes incremental updates.** Pagefind's index chunks are structured so that adding a single page distributes words across all chunks, requiring all to be regenerated.
2. **Change detection in CI is unreliable** — fresh checkouts have meaningless timestamps, and parsing git history is fragile.
3. **Performance is already fast.** For most sites, full re-indexing takes seconds. Even at 10K pages, full indexing should complete in under a minute.

### Practical impact

For ~1,400 pages, Pagefind indexing is likely **5–15 seconds**. This is not the bottleneck. At 10K pages it might reach 30–60 seconds, which is still acceptable.

Caching the `dist/` directory (as suggested in the original analysis) would not help Pagefind directly — it always scans all HTML files. It could theoretically help with deployment (incremental uploads), but GitHub Pages deploys a full artifact each time anyway.

---

## Recommendations (Priority Order)

### 1. Upgrade `withastro/action` to v5 (immediate, low effort)

The project uses `@v3` but the current version is `@v5`. Version 5 includes:
- Better pnpm support
- Improved `.astro/` build cache handling (uses `actions/cache` v5)
- Node 22 default
- Better error handling

Change in `deploy.yml`:
```yaml
- uses: withastro/action@v5
```

This single change gives you content layer caching, image optimization caching, and package manager store caching automatically.

### 2. No config changes needed for content caching

Since Astro 5.x has content layer caching built in, and `withastro/action` persists the `.astro/` directory, **you do not need to add any `experimental` flags or manual cache steps**. The original suggestion to enable `experimental.contentCollectionCache` is outdated — that flag no longer exists in Astro 5.

### 3. Consider moving `cacheDir` out of `node_modules` (optional)

By default, Astro caches in `node_modules/.astro`. The action handles this, but if you ever want more control (or move off the action), you can set:

```js
// astro.config.mjs
export default defineConfig({
  cacheDir: './.astro',
  // ...
});
```

This makes the cache directory a top-level directory you can cache independently. Not strictly necessary while using `withastro/action`, but useful if you customize your workflow later.

### 4. Don't optimize Pagefind (not a bottleneck)

At 1,400 pages, Pagefind is a few seconds. At 10K it will be under a minute. No action needed.

### 5. At 10K+ pages, consider build profiling

When you approach 10K documents:
- Add `--verbose` to the build command to identify bottlenecks
- Consider whether the Astro build time (HTML rendering, not content parsing) warrants architectural changes like splitting collections into sub-sites
- Evaluate Cloudflare Pages if GitHub Pages build times or artifact limits become constraints

---

## Proposed Changes

### `deploy.yml` — upgrade action version

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Build and upload
        uses: withastro/action@v5

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

This is the only change needed. The action handles `.astro/` caching, pnpm setup, and Node.js configuration automatically.

---

## Summary

| Original suggestion | Status for Astro 5.6.x |
|---|---|
| Enable `experimental.contentCollectionCache` | **Removed in Astro 5** — content layer caching is built in |
| Cache `.astro/` in CI | **Already handled** by `withastro/action` (upgrade to v5) |
| Cache `node_modules/` with pnpm | **Partially handled** by `withastro/action` (pnpm store cached via setup-node) |
| Cache `dist/` for Pagefind | **Not useful** — Pagefind always does full re-index; not a bottleneck |
| Profile builds at scale | **Still good advice** — do this when approaching 10K pages |

The key takeaway: upgrading `withastro/action` from v3 to v5 gets you most of the caching benefits automatically, with zero configuration changes to `astro.config.mjs`.

---

## Sources

- [Astro 5.0 Release Blog](https://astro.build/blog/astro-5/)
- [Astro Content Layer Deep Dive](https://astro.build/blog/content-layer-deep-dive/)
- [Astro v5 Upgrade Guide](https://docs.astro.build/en/guides/upgrade-to/v5/)
- [Astro Configuration Reference — cacheDir](https://docs.astro.build/en/reference/configuration-reference/)
- [withastro/action Repository](https://github.com/withastro/action)
- [Pagefind Discussion #831: Incremental Indexing](https://github.com/Pagefind/pagefind/discussions/831)
- [Caching Astro Build Assets on CI](https://walterra.dev/blog/2025-11-09-astro-build-caching)
