/**
 * Markdown Processor
 * Parses Obsidian-flavoured markdown:
 *  - YAML frontmatter extraction
 *  - Wikilinks: [[Page]] and [[Page|Alias]]
 *  - Embedded images: ![[image.png]]
 *  - Tags: #tag
 *  - Standard markdown elements (headings, bold, italic, code, lists, links, blockquotes, tables, HR)
 */

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from the top of a markdown document.
 * Returns { frontmatter: Record<string,any>, body: string }.
 */
function parseFrontmatter(raw) {
  const fm = {};
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: fm, body: raw };

  const yamlText = match[1];
  const body = raw.slice(match[0].length);

  // Minimal YAML parser: handles key: value and key: [item, item] arrays
  for (const line of yamlText.split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      // Inline array: [a, b, c]
      fm[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (val === 'true') {
      fm[key] = true;
    } else if (val === 'false') {
      fm[key] = false;
    } else if (val !== '' && !isNaN(Number(val))) {
      fm[key] = Number(val);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter: fm, body };
}

// ---------------------------------------------------------------------------
// Inline escaping helpers
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

// ---------------------------------------------------------------------------
// Wikilink & Obsidian-specific processing
// ---------------------------------------------------------------------------

/**
 * Replace Obsidian wikilinks in a line of text (not inside code spans).
 *
 * Patterns:
 *  ![[image.ext]]           → <img> tag
 *  ![[image.ext|alt]]       → <img> with alt
 *  [[Page#heading|Alias]]   → anchor link
 *  [[Page|Alias]]           → anchor link
 *  [[Page]]                 → anchor link
 *
 * @param {string} text
 * @param {Map<string,string>} wikilinkMap  - note name (lower) → slug
 * @param {string} currentSlug             - slug of the page being rendered
 * @returns {string}
 */
function resolveWikilinks(text, wikilinkMap, currentSlug) {
  // Embedded image: ![[file.ext]] or ![[file.ext|alt]]
  text = text.replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_m, target, alt) => {
    const cleanTarget = target.trim();
    const altText = escapeAttr(alt ? alt.trim() : cleanTarget);
    // Images are referenced relative to an assets directory
    return `<img src="../assets/${escapeAttr(cleanTarget)}" alt="${altText}" class="obsidian-embed">`;
  });

  // Text wikilinks: [[Page#heading|Alias]] or [[Page|Alias]] or [[Page]]
  text = text.replace(/\[\[([^\]|#]+?)(?:#([^\]|]*?))?(?:\|([^\]]*?))?\]\]/g, (_m, page, heading, alias) => {
    const pageName = page.trim();
    const displayText = escapeHtml(alias ? alias.trim() : pageName);
    const slug = wikilinkMap.get(pageName.toLowerCase()) ?? null;

    let href;
    if (slug) {
      const depth = currentSlug.split('/').length - 1;
      const prefix = depth > 0 ? '../'.repeat(depth) : './';
      href = `${prefix}${slug}.html${heading ? '#' + slugifyHeading(heading.trim()) : ''}`;
    } else {
      // Unresolved link — still render but mark as broken
      href = `#unresolved-${escapeAttr(pageName)}`;
    }

    const cls = slug ? 'wikilink' : 'wikilink wikilink--broken';
    return `<a href="${href}" class="${cls}">${displayText}</a>`;
  });

  return text;
}

/** Convert a heading string to an HTML id. */
function slugifyHeading(heading) {
  return heading
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

// ---------------------------------------------------------------------------
// Inline markdown
// ---------------------------------------------------------------------------

/**
 * Process inline markdown elements within a single line of text.
 * Code spans are processed first to prevent re-processing their content.
 */
function processInline(text, wikilinkMap, currentSlug) {
  // Protect code spans first — collect them and replace with placeholders
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (_m, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00CODE${codeSpans.length - 1}\x00`;
  });

  // Wikilinks (Obsidian-specific)
  text = resolveWikilinks(text, wikilinkMap, currentSlug);

  // Tags: #tagname (not inside URLs)
  text = text.replace(/(?<!["/\w])#([a-zA-Z][\w/-]*)/g, (_m, tag) => {
    return `<span class="tag">#${escapeHtml(tag)}</span>`;
  });

  // Bold+italic: ***text*** or ___text___
  text = text.replace(/(\*{3}|_{3})(.+?)\1/g, (_m, _d, t) => `<strong><em>${t}</em></strong>`);
  // Bold: **text** or __text__
  text = text.replace(/(\*{2}|_{2})(.+?)\1/g, (_m, _d, t) => `<strong>${t}</strong>`);
  // Italic: *text* or _text_
  text = text.replace(/(\*|_)(.+?)\1/g, (_m, _d, t) => `<em>${t}</em>`);
  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, (_m, t) => `<del>${t}</del>`);
  // Highlight: ==text==
  text = text.replace(/==(.+?)==/g, (_m, t) => `<mark>${t}</mark>`);

  // Standard links: [text](url)
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = escapeAttr(url);
    const external = /^https?:\/\//.test(url);
    const rel = external ? ' rel="noopener noreferrer"' : '';
    const target = external ? ' target="_blank"' : '';
    return `<a href="${safeUrl}"${target}${rel}>${escapeHtml(label)}</a>`;
  });

  // Reference-style images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}">`;
  });

  // Restore code spans
  text = text.replace(/\x00CODE(\d+)\x00/g, (_m, i) => codeSpans[Number(i)]);

  return text;
}

// ---------------------------------------------------------------------------
// Block-level markdown
// ---------------------------------------------------------------------------

/**
 * Convert markdown body to HTML.
 * @param {string} body           - raw markdown (frontmatter already stripped)
 * @param {Map<string,string>} wikilinkMap
 * @param {string} currentSlug
 * @returns {string}              - HTML string
 */
function markdownToHtml(body, wikilinkMap = new Map(), currentSlug = '') {
  const lines = body.split(/\r?\n/);
  const html = [];

  let i = 0;
  let inOrderedList = false;
  let inUnorderedList = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];

  const closeOpenBlocks = () => {
    if (inUnorderedList) { html.push('</ul>'); inUnorderedList = false; }
    if (inOrderedList) { html.push('</ol>'); inOrderedList = false; }
    if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false; }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw;

    // --- Fenced code block ---
    if (inCodeBlock) {
      if (/^```/.test(line)) {
        const langClass = codeLang ? ` class="language-${escapeAttr(codeLang)}"` : '';
        html.push(`<pre><code${langClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeLang = '';
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      i++;
      continue;
    }

    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      closeOpenBlocks();
      inCodeBlock = true;
      codeLang = fenceMatch[1];
      codeLines = [];
      i++;
      continue;
    }

    // --- Horizontal rule ---
    if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      closeOpenBlocks();
      html.push('<hr>');
      i++;
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      closeOpenBlocks();
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2], wikilinkMap, currentSlug);
      const id = slugifyHeading(headingMatch[2]);
      html.push(`<h${level} id="${id}">${text}</h${level}>`);
      i++;
      continue;
    }

    // --- Blockquote ---
    if (/^>\s?/.test(line)) {
      if (!inBlockquote) {
        closeOpenBlocks();
        html.push('<blockquote>');
        inBlockquote = true;
      }
      const bqContent = line.replace(/^>\s?/, '');
      html.push(`<p>${processInline(escapeHtml(bqContent), wikilinkMap, currentSlug)}</p>`);
      i++;
      continue;
    } else if (inBlockquote) {
      html.push('</blockquote>');
      inBlockquote = false;
    }

    // --- Unordered list ---
    const ulMatch = line.match(/^(\s*)[*\-+]\s+(.*)/);
    if (ulMatch) {
      if (!inUnorderedList) {
        closeOpenBlocks();
        html.push('<ul>');
        inUnorderedList = true;
      }
      const checked = ulMatch[2].match(/^\[(x| )\]\s+(.*)/i);
      if (checked) {
        const isChecked = checked[1].toLowerCase() === 'x';
        html.push(`<li class="task-item"><input type="checkbox"${isChecked ? ' checked' : ''} disabled> ${processInline(escapeHtml(checked[2]), wikilinkMap, currentSlug)}</li>`);
      } else {
        html.push(`<li>${processInline(escapeHtml(ulMatch[2]), wikilinkMap, currentSlug)}</li>`);
      }
      i++;
      continue;
    } else if (inUnorderedList && line.trim() !== '') {
      html.push('</ul>');
      inUnorderedList = false;
    }

    // --- Ordered list ---
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inOrderedList) {
        closeOpenBlocks();
        html.push('<ol>');
        inOrderedList = true;
      }
      html.push(`<li>${processInline(escapeHtml(olMatch[1]), wikilinkMap, currentSlug)}</li>`);
      i++;
      continue;
    } else if (inOrderedList && line.trim() !== '') {
      html.push('</ol>');
      inOrderedList = false;
    }

    // --- Table ---
    if (/^\|/.test(line)) {
      closeOpenBlocks();
      const tableLines = [line];
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1])) {
        i++;
        tableLines.push(lines[i]);
      }
      html.push(parseTable(tableLines, wikilinkMap, currentSlug));
      i++;
      continue;
    }

    // --- Blank line ---
    if (line.trim() === '') {
      closeOpenBlocks();
      i++;
      continue;
    }

    // --- Paragraph ---
    closeOpenBlocks();
    const paraLines = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^[#>*\-+`|]/.test(lines[i + 1]) && !/^\d+\./.test(lines[i + 1])) {
      i++;
      paraLines.push(lines[i]);
    }
    const paraHtml = processInline(escapeHtml(paraLines.join(' ')), wikilinkMap, currentSlug);
    html.push(`<p>${paraHtml}</p>`);

    i++;
  }

  closeOpenBlocks();

  if (inCodeBlock && codeLines.length > 0) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return html.join('\n');
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

function parseTable(tableLines, wikilinkMap, currentSlug) {
  const rows = tableLines.map(l => l.split('|').slice(1, -1).map(c => c.trim()));

  // Find separator row (row with only dashes/colons)
  const sepIdx = rows.findIndex(row => row.every(c => /^:?-+:?$/.test(c)));
  if (sepIdx === -1) {
    // No separator — treat all as body rows
    return buildTable([], rows, wikilinkMap, currentSlug);
  }

  const headers = rows.slice(0, sepIdx);
  const body = rows.slice(sepIdx + 1);
  return buildTable(headers, body, wikilinkMap, currentSlug);
}

function buildTable(headers, body, wikilinkMap, currentSlug) {
  const parts = ['<table>'];
  if (headers.length > 0) {
    parts.push('<thead>');
    for (const row of headers) {
      parts.push('<tr>' + row.map(c => `<th>${processInline(escapeHtml(c), wikilinkMap, currentSlug)}</th>`).join('') + '</tr>');
    }
    parts.push('</thead>');
  }
  if (body.length > 0) {
    parts.push('<tbody>');
    for (const row of body) {
      parts.push('<tr>' + row.map(c => `<td>${processInline(escapeHtml(c), wikilinkMap, currentSlug)}</td>`).join('') + '</tr>');
    }
    parts.push('</tbody>');
  }
  parts.push('</table>');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { parseFrontmatter, markdownToHtml, escapeHtml, slugifyHeading };
