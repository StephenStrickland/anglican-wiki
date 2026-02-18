# Anglican Wiki

A scholarly resource for Anglican theology and liturgy, built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Project Structure

```
.
├── public/assets/          # Downloadable PDFs and EPUBs
├── scripts/                # Crawler and transform tooling
│   ├── crawl.mjs           # CLI: crawl anglicanhistory.org
│   ├── transform.mjs       # CLI: convert archived HTML to Markdown
│   └── lib/                # Shared modules
├── src/
│   ├── assets/             # Images (processed at build time)
│   ├── components/         # Custom Astro components
│   ├── content/docs/       # Site content (Markdown / MDX)
│   └── styles/             # Custom CSS
├── archive/                # Crawled HTML (git-ignored)
├── astro.config.mjs
└── package.json
```

Content lives in `src/content/docs/` as `.md` or `.mdx` files. Each file becomes a page routed by its file path.

## Commands

| Command | Action |
|:--------|:-------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local dev server at `localhost:4321` |
| `pnpm build` | Build production site to `./dist/` |
| `pnpm preview` | Preview production build locally |
| `pnpm run crawl` | Crawl anglicanhistory.org into `archive/` |
| `pnpm run transform` | Transform archived HTML to Markdown |

## Project Canterbury

The `scripts/` directory contains tooling to archive and transform [anglicanhistory.org](https://anglicanhistory.org) (Project Canterbury), a CC BY-NC-SA 2.5 archive of out-of-print Anglican texts.

### Crawling

```bash
pnpm run crawl              # Full crawl (resumes from manifest)
pnpm run crawl -- --force   # Re-crawl everything
pnpm run crawl -- --dry-run # Show what would be crawled
```

The crawler saves raw HTML to `archive/`, mirroring the site's directory structure. Progress is tracked in `archive/.manifest.json` so crawls are resumable. The crawler is polite: 2 concurrent requests, 500ms interval, custom User-Agent. PDFs are recorded in the manifest but not downloaded. Images are downloaded.

### Transforming

```bash
pnpm run transform              # Transform all archived HTML
pnpm run transform -- --force   # Overwrite existing .md files
pnpm run transform -- --dry-run # Show what would be generated
```

The transform pipeline reads each archived HTML file, extracts metadata (title, description), strips site navigation chrome, converts to Markdown with Starlight frontmatter, and writes to `src/content/docs/project-canterbury/`. Internal links are rewritten to Starlight paths. PDF entries become stub pages linking to the original.
