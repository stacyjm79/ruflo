/**
 * Vault Reader
 * Scans an Obsidian vault directory and collects all markdown files,
 * images, and attachments while respecting Obsidian's conventions.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';

/** Directories to skip when scanning the vault */
const SKIP_DIRS = new Set(['.obsidian', '.trash', '.git', 'node_modules', '.DS_Store']);

/** File extensions treated as markdown */
const MD_EXTENSIONS = new Set(['.md', '.markdown']);

/**
 * Recursively collect all markdown files under a directory.
 * @param {string} dir - Absolute path to scan
 * @param {string} root - Vault root (for computing relative paths)
 * @returns {Promise<Array<{absPath: string, relPath: string, slug: string}>>}
 */
async function collectMarkdownFiles(dir, root) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const absPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(absPath, root);
      results.push(...nested);
    } else if (entry.isFile() && MD_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      const relPath = relative(root, absPath);
      const slug = relPathToSlug(relPath);
      results.push({ absPath, relPath, slug });
    }
  }

  return results;
}

/**
 * Convert a relative file path to a URL slug.
 * "notes/My Note.md" → "notes/my-note"
 */
function relPathToSlug(relPath) {
  return relPath
    .replace(/\.(md|markdown)$/i, '')
    .split(/[\\/]/)
    .map(segment => slugify(segment))
    .join('/');
}

/**
 * Slugify a single path segment.
 * Keeps alphanumerics, hyphens, and underscores; replaces spaces with hyphens.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Read a single vault file.
 * @param {string} absPath
 * @returns {Promise<string>}
 */
async function readVaultFile(absPath) {
  return readFile(absPath, 'utf8');
}

/**
 * Build a lookup map from note title/name → slug for wikilink resolution.
 * @param {Array<{absPath: string, relPath: string, slug: string}>} files
 * @returns {Map<string, string>}  key = lowercased note name, value = slug
 */
function buildWikilinkMap(files) {
  const map = new Map();
  for (const file of files) {
    // Index by basename without extension (lowercased)
    const name = basename(file.relPath).replace(/\.(md|markdown)$/i, '').toLowerCase();
    if (!map.has(name)) {
      map.set(name, file.slug);
    }
    // Also index by full slug
    map.set(file.slug.toLowerCase(), file.slug);
  }
  return map;
}

/**
 * Check whether a path exists and is a directory.
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function isDirectory(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export { collectMarkdownFiles, readVaultFile, buildWikilinkMap, slugify, relPathToSlug, isDirectory };
