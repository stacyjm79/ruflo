/**
 * Build Command
 * Converts an Obsidian vault into a self-contained static site.
 *
 * Usage:
 *   obsidian-site build --source /path/to/vault [--output ./dist] [--title "My Notes"]
 */

import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { join, dirname, basename, extname, resolve } from 'node:path';

import { collectMarkdownFiles, readVaultFile, buildWikilinkMap, isDirectory } from './vault-reader.js';
import { parseFrontmatter, markdownToHtml } from './markdown.js';
import { renderPage, renderIndexPage } from './template.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the human-readable title for a note. Priority: frontmatter.title > h1 > filename. */
function resolveTitle(frontmatter, body, relPath) {
  if (frontmatter.title) return String(frontmatter.title);
  const h1 = body.match(/^#\s+(.+)/m);
  if (h1) return h1[1].replace(/\*+|_+|`/g, '').trim();
  return basename(relPath).replace(/\.(md|markdown)$/i, '');
}

/** Resolve short description for a note (frontmatter.description > first paragraph). */
function resolveDescription(frontmatter, body) {
  if (frontmatter.description) return String(frontmatter.description);
  const para = body.replace(/^---[\s\S]*?---\n?/, '').match(/^(?!#)(.{10,200})/m);
  return para ? para[1].replace(/[*_`[\]]/g, '').trim() : '';
}

/** Ensure a directory exists (recursive). */
async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

/** Copy a single file, creating destination directory if needed. */
async function safeCopyFile(src, dest) {
  await ensureDir(dirname(dest));
  await copyFile(src, dest);
}

// ---------------------------------------------------------------------------
// Asset copying (images referenced in notes)
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);

async function copyAttachments(vaultDir, outputDir) {
  const assetsOut = join(outputDir, 'assets');
  let copied = 0;

  async function scanDir(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (['.obsidian', '.trash', '.git', 'node_modules'].includes(entry.name)) continue;
      const srcPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(srcPath);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const destPath = join(assetsOut, entry.name);
        await safeCopyFile(srcPath, destPath);
        copied++;
      }
    }
  }

  await ensureDir(assetsOut);
  await scanDir(vaultDir);
  return copied;
}

// ---------------------------------------------------------------------------
// Main build function
// ---------------------------------------------------------------------------

/**
 * Build a static site from an Obsidian vault.
 *
 * @param {object} options
 * @param {string}  options.source     - path to vault directory
 * @param {string}  [options.output]   - output directory (default: ./dist)
 * @param {string}  [options.title]    - site title (default: vault folder name)
 * @param {boolean} [options.verbose]  - print per-file progress
 * @param {function} [options.log]     - logger function (default: console.log)
 * @returns {Promise<{pages: number, skipped: number, outputDir: string}>}
 */
async function build(options = {}) {
  const vaultDir = resolve(options.source);
  const outputDir = resolve(options.output ?? './dist');
  const siteTitle = options.title ?? basename(vaultDir);
  const verbose = options.verbose ?? false;
  const log = options.log ?? console.log;

  // ---- Validate source ----
  if (!(await isDirectory(vaultDir))) {
    throw new Error(`Source path is not a directory: ${vaultDir}`);
  }

  log(`\n📂 Vault:  ${vaultDir}`);
  log(`📁 Output: ${outputDir}`);
  log(`🏷️  Title:  ${siteTitle}\n`);

  // ---- Collect files ----
  log('Scanning vault…');
  const files = await collectMarkdownFiles(vaultDir, vaultDir);
  if (files.length === 0) {
    log('No markdown files found in vault.');
    return { pages: 0, skipped: 0, outputDir };
  }
  log(`Found ${files.length} markdown file(s).`);

  // ---- Build wikilink map ----
  const wikilinkMap = buildWikilinkMap(files);

  // ---- First pass: parse frontmatter + resolve titles ----
  const noteMeta = [];
  for (const file of files) {
    const raw = await readVaultFile(file.absPath);
    const { frontmatter, body } = parseFrontmatter(raw);
    const title = resolveTitle(frontmatter, body, file.relPath);
    const description = resolveDescription(frontmatter, body);
    noteMeta.push({ ...file, frontmatter, body, title, description });
  }

  // ---- Sort navigation alphabetically ----
  const allNavFiles = noteMeta
    .map(n => ({ slug: n.slug, title: n.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // ---- Ensure output directory ----
  await ensureDir(outputDir);

  // ---- Second pass: render HTML ----
  let pages = 0;
  let skipped = 0;
  let hasIndex = false;

  for (const note of noteMeta) {
    if (note.slug === 'index') hasIndex = true;

    try {
      const content = markdownToHtml(note.body, wikilinkMap, note.slug);

      const html = renderPage({
        title: note.title,
        siteTitle,
        content,
        frontmatter: note.frontmatter,
        slug: note.slug,
        allFiles: allNavFiles,
      });

      const outPath = join(outputDir, `${note.slug}.html`);
      await ensureDir(dirname(outPath));
      await writeFile(outPath, html, 'utf8');

      if (verbose) log(`  ✓ ${note.relPath} → ${note.slug}.html`);
      pages++;
    } catch (err) {
      log(`  ✗ ${note.relPath}: ${err.message}`);
      skipped++;
    }
  }

  // ---- Generate auto-index if missing ----
  if (!hasIndex) {
    const indexHtml = renderIndexPage(siteTitle, noteMeta, allNavFiles);
    await writeFile(join(outputDir, 'index.html'), indexHtml, 'utf8');
    if (verbose) log('  ✓ (auto-generated) index.html');
  }

  // ---- Copy attachments (images etc.) ----
  const attachmentsCopied = await copyAttachments(vaultDir, outputDir);
  if (attachmentsCopied > 0) {
    log(`Copied ${attachmentsCopied} attachment(s) to assets/.`);
  }

  log(`\n✅ Built ${pages} page(s)${skipped > 0 ? `, skipped ${skipped}` : ''}.`);
  log(`   Output: ${outputDir}\n`);

  return { pages, skipped, outputDir };
}

export { build };
