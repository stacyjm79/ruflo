/**
 * HTML Template
 * Generates full HTML pages and the site's navigation sidebar.
 */

import { escapeHtml } from './markdown.js';

// ---------------------------------------------------------------------------
// CSS (inlined for zero-dependency output)
// ---------------------------------------------------------------------------

const STYLES = `
:root {
  --bg: #1e1e2e;
  --surface: #252537;
  --border: #3a3a5c;
  --text: #cdd6f4;
  --muted: #7f849c;
  --accent: #89b4fa;
  --accent-hover: #b4d0fb;
  --link: #89dceb;
  --link-broken: #f38ba8;
  --tag-bg: #313244;
  --tag-text: #a6e3a1;
  --code-bg: #181825;
  --mark-bg: #f9e2af30;
  --mark-text: #f9e2af;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace;
  --sidebar-width: 260px;
  --content-max: 800px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 16px; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  line-height: 1.7;
  display: flex;
  min-height: 100vh;
}

/* ---- Sidebar ---- */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 1.5rem 1rem;
  overflow-y: auto;
  position: sticky;
  top: 0;
  height: 100vh;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.02em;
}

.nav-tree { list-style: none; }
.nav-tree li { margin: 0.15rem 0; }

.nav-tree a {
  display: block;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  color: var(--text);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-tree a:hover { background: var(--border); color: var(--accent-hover); }
.nav-tree a.active { background: var(--accent); color: #1e1e2e; font-weight: 600; }

.nav-group-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 1rem 0.6rem 0.25rem;
}

/* ---- Main content ---- */
main {
  flex: 1;
  padding: 2.5rem 3rem;
  max-width: calc(var(--content-max) + 6rem);
  margin: 0 auto;
  min-width: 0;
}

article { max-width: var(--content-max); }

.page-title {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  color: var(--accent);
}

.page-meta {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
}

/* ---- Typography ---- */
h1, h2, h3, h4, h5, h6 {
  margin: 1.75rem 0 0.6rem;
  line-height: 1.3;
  font-weight: 600;
  scroll-margin-top: 1.5rem;
}
h1 { font-size: 1.8rem; color: var(--accent); }
h2 { font-size: 1.45rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
h3 { font-size: 1.2rem; }
h4 { font-size: 1.05rem; }
h5, h6 { font-size: 1rem; color: var(--muted); }

p { margin: 0.8rem 0; }

a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }

.wikilink { color: var(--accent); }
.wikilink--broken { color: var(--link-broken); text-decoration: line-through; }

strong { font-weight: 700; }
em { font-style: italic; }
del { text-decoration: line-through; opacity: 0.7; }
mark { background: var(--mark-bg); color: var(--mark-text); padding: 0 2px; border-radius: 2px; }

/* ---- Code ---- */
code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--code-bg);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  color: #f38ba8;
}

pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  overflow-x: auto;
  margin: 1rem 0;
}
pre code {
  background: none;
  padding: 0;
  color: var(--text);
  font-size: 0.875rem;
  line-height: 1.6;
}

/* ---- Lists ---- */
ul, ol { padding-left: 1.75rem; margin: 0.75rem 0; }
li { margin: 0.3rem 0; }
.task-item { list-style: none; margin-left: -1rem; }
.task-item input[type="checkbox"] { margin-right: 0.5rem; accent-color: var(--accent); }

/* ---- Blockquotes ---- */
blockquote {
  border-left: 3px solid var(--accent);
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  background: var(--surface);
  border-radius: 0 6px 6px 0;
  color: var(--muted);
}

/* ---- Tables ---- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.9rem;
}
th, td {
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  text-align: left;
}
th { background: var(--surface); font-weight: 600; color: var(--accent); }
tr:hover td { background: var(--surface); }

/* ---- HR ---- */
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }

/* ---- Tags ---- */
.tag {
  display: inline-block;
  background: var(--tag-bg);
  color: var(--tag-text);
  font-size: 0.78rem;
  padding: 0.1em 0.55em;
  border-radius: 99px;
  font-weight: 500;
}

/* ---- Images ---- */
img, .obsidian-embed {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.5rem 0;
  display: block;
}

/* ---- Index page ---- */
.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}
.note-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.2s, transform 0.15s;
  display: block;
}
.note-card:hover { border-color: var(--accent); transform: translateY(-2px); text-decoration: none; }
.note-card-title { font-weight: 600; color: var(--accent); margin-bottom: 0.3rem; }
.note-card-desc { font-size: 0.82rem; color: var(--muted); }

/* ---- Responsive ---- */
@media (max-width: 768px) {
  body { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 1.5rem 1.25rem; }
}
`;

// ---------------------------------------------------------------------------
// Navigation tree builder
// ---------------------------------------------------------------------------

/**
 * Build a hierarchical navigation structure from flat file list.
 * @param {Array<{slug: string, title: string}>} files
 * @returns {Array<{label: string, children: Array<{slug, title}>, files: Array<{slug, title}>}>}
 */
function buildNavTree(files) {
  const groups = new Map();
  const root = [];

  for (const f of files) {
    const parts = f.slug.split('/');
    if (parts.length === 1) {
      root.push(f);
    } else {
      const group = parts[0];
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(f);
    }
  }

  const result = [];
  if (root.length > 0) result.push({ label: null, files: root });
  for (const [label, files] of groups) {
    result.push({ label, files });
  }
  return result;
}

/**
 * Render sidebar navigation HTML.
 * @param {Array<{slug: string, title: string}>} allFiles
 * @param {string} currentSlug
 * @param {string} siteTitle
 * @returns {string}
 */
function renderSidebar(allFiles, currentSlug, siteTitle) {
  const groups = buildNavTree(allFiles);
  const depth = currentSlug.split('/').length - 1;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';

  const navItems = groups.map(group => {
    const groupHtml = group.label ? `<li class="nav-group-label">${escapeHtml(group.label)}</li>` : '';
    const fileItems = group.files.map(f => {
      const isActive = f.slug === currentSlug;
      const cls = isActive ? ' class="active"' : '';
      const href = f.slug === 'index' ? `${prefix}index.html` : `${prefix}${f.slug}.html`;
      return `<li><a href="${href}"${cls}>${escapeHtml(f.title)}</a></li>`;
    }).join('\n');
    return `${groupHtml}\n${fileItems}`;
  }).join('\n');

  return `
<nav class="sidebar">
  <div class="sidebar-title">${escapeHtml(siteTitle)}</div>
  <ul class="nav-tree">
    ${navItems}
  </ul>
</nav>`;
}

// ---------------------------------------------------------------------------
// Page template
// ---------------------------------------------------------------------------

/**
 * Render a full HTML page.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.siteTitle
 * @param {string} opts.content    - pre-rendered HTML body
 * @param {object} opts.frontmatter
 * @param {string} opts.slug
 * @param {Array<{slug, title}>} opts.allFiles
 * @returns {string}
 */
function renderPage({ title, siteTitle, content, frontmatter, slug, allFiles }) {
  const sidebar = renderSidebar(allFiles, slug, siteTitle);

  const metaParts = [];
  if (frontmatter.date) metaParts.push(`<span>📅 ${escapeHtml(String(frontmatter.date))}</span>`);
  if (frontmatter.tags) {
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
    metaParts.push(tags.map(t => `<span class="tag">#${escapeHtml(String(t))}</span>`).join(' '));
  }
  if (frontmatter.author) metaParts.push(`<span>✍️ ${escapeHtml(String(frontmatter.author))}</span>`);

  const metaHtml = metaParts.length > 0 ? `<div class="page-meta">${metaParts.join(' ')}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — ${escapeHtml(siteTitle)}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${sidebar}
  <main>
    <article>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      ${metaHtml}
      ${content}
    </article>
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Index page
// ---------------------------------------------------------------------------

/**
 * Render the auto-generated index page.
 * @param {string} siteTitle
 * @param {Array<{slug: string, title: string, description: string}>} files
 * @param {Array<{slug, title}>} allFiles
 * @returns {string}
 */
function renderIndexPage(siteTitle, files, allFiles) {
  const sidebar = renderSidebar(allFiles, 'index', siteTitle);

  const cards = files
    .filter(f => f.slug !== 'index')
    .map(f => `
    <a class="note-card" href="./${f.slug}.html">
      <div class="note-card-title">${escapeHtml(f.title)}</div>
      ${f.description ? `<div class="note-card-desc">${escapeHtml(f.description)}</div>` : ''}
    </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteTitle)}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${sidebar}
  <main>
    <article>
      <h1 class="page-title">${escapeHtml(siteTitle)}</h1>
      <p style="color:var(--muted)">${files.filter(f => f.slug !== 'index').length} notes</p>
      <div class="note-grid">
        ${cards}
      </div>
    </article>
  </main>
</body>
</html>`;
}

export { renderPage, renderIndexPage, renderSidebar };
