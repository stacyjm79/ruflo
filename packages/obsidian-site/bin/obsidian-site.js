#!/usr/bin/env node
/**
 * obsidian-site CLI
 *
 * Commands:
 *   build   Build a static site from an Obsidian vault
 *
 * Usage:
 *   obsidian-site build --source <vault-path> [options]
 *
 * Options (build):
 *   --source, -s   <path>   Path to the Obsidian vault directory (required)
 *   --output, -o   <path>   Output directory (default: ./dist)
 *   --title,  -t   <text>   Site title (default: vault folder name)
 *   --verbose, -v           Print progress for each file
 *   --help,   -h            Show this help message
 *   --version               Print version
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ---------------------------------------------------------------------------
// Argument parser (no external deps)
// ---------------------------------------------------------------------------

/**
 * Parse process.argv into a structured args object.
 * @param {string[]} argv - typically process.argv.slice(2)
 * @returns {{ command: string|null, flags: Record<string, string|boolean>, rest: string[] }}
 */
function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--') {
      // everything after -- is positional
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortMap = { s: 'source', o: 'output', t: 'title', v: 'verbose', h: 'help' };
      const full = shortMap[arg[1]];
      if (full) {
        if (full !== 'verbose' && full !== 'help' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          flags[full] = argv[++i];
        } else {
          flags[full] = true;
        }
      } else {
        flags[arg.slice(1)] = true;
      }
    } else {
      positional.push(arg);
    }

    i++;
  }

  return {
    command: positional[0] ?? null,
    flags,
    rest: positional.slice(1),
  };
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
obsidian-site v${getVersion()} — Build static sites from Obsidian vaults

USAGE
  obsidian-site <command> [options]

COMMANDS
  build     Convert an Obsidian vault to a static HTML site

OPTIONS (build)
  --source,  -s <path>   Path to Obsidian vault directory  (required)
  --output,  -o <path>   Output directory                  (default: ./dist)
  --title,   -t <text>   Site title                        (default: vault folder name)
  --verbose, -v          Print progress for each file
  --help,    -h          Show this help message
  --version              Print version

EXAMPLES
  obsidian-site build --source ~/Documents/MyVault
  obsidian-site build --source ./vault --output ./public --title "My Notes"
  obsidian-site build -s /path/to/vault -o ./site -v
`);
}

function printBuildHelp() {
  console.log(`
USAGE
  obsidian-site build --source <vault-path> [options]

OPTIONS
  --source,  -s <path>   Path to Obsidian vault directory  (required)
  --output,  -o <path>   Output directory                  (default: ./dist)
  --title,   -t <text>   Site title                        (default: vault folder name)
  --verbose, -v          Print progress for each file
  --help,    -h          Show this help

EXAMPLES
  obsidian-site build --source ~/Documents/MyVault
  obsidian-site build -s ./vault -o ./public --title "My Notes" -v
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (flags.version) {
    console.log(getVersion());
    process.exit(0);
  }

  if (!command || flags.help) {
    if (command === 'build' && flags.help) {
      printBuildHelp();
    } else {
      printHelp();
    }
    process.exit(0);
  }

  if (command === 'build') {
    if (!flags.source) {
      console.error('Error: --source <vault-path> is required.\n');
      printBuildHelp();
      process.exit(1);
    }

    // Lazy-import build to keep startup fast
    const { build } = await import('../src/build.js');

    try {
      await build({
        source: String(flags.source),
        output: flags.output ? String(flags.output) : undefined,
        title: flags.title ? String(flags.title) : undefined,
        verbose: Boolean(flags.verbose),
      });
    } catch (err) {
      console.error(`\nBuild failed: ${err.message}\n`);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }

    return;
  }

  console.error(`Unknown command: "${command}"\nRun \`obsidian-site --help\` for usage.\n`);
  process.exit(1);
}

main();
