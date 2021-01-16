import fs from 'fs';
import toHTML from 'hast-util-to-html';
import h from 'hastscript';
import { imageSize } from 'image-size';
import { lookup as mime } from 'mime-types';
import shelljs from 'shelljs';
import path from 'upath';
import { contextResolve, Entry, MergedConfig, ParsedEntry } from './config';
import { processMarkdown } from './markdown';
import { debug } from './util';

export interface ManifestOption {
  title?: string;
  author?: string;
  language?: string;
  modified: string;
  entries: Entry[];
  toc?: boolean | string;
  cover?: string;
}

export interface ManifestEntry {
  href: string;
  type: string;
  rel?: string;
  [index: string]: number | string | undefined;
}

export function cleanup(location: string) {
  shelljs.rm('-rf', location);
}

// example: https://github.com/readium/webpub-manifest/blob/master/examples/MobyDick/manifest.json
export function generateManifest(outputPath: string, options: ManifestOption) {
  const entries: ManifestEntry[] = options.entries.map((entry) => ({
    href: entry.path,
    type: 'text/html',
    title: entry.title,
  }));
  const links: ManifestEntry[] = [];
  const resources: ManifestEntry[] = [];

  if (options.toc) {
    entries.splice(0, 0, {
      href: 'toc.html',
      rel: 'contents',
      type: 'text/html',
      title: 'Table of Contents',
    });
  }

  if (options.cover) {
    const { width, height, type } = imageSize(options.cover);
    if (type) {
      const mimeType = mime(type);
      if (mimeType) {
        const coverPath = `cover.${type}`;
        links.push({
          rel: 'cover',
          href: coverPath,
          type: mimeType,
          width,
          height,
        });
      }
    }
  }

  const manifest = {
    '@context': 'https://readium.org/webpub-manifest/context.jsonld',
    metadata: {
      '@type': 'http://schema.org/Book',
      title: options.title,
      author: options.author,
      language: options.language,
      modified: options.modified,
    },
    links,
    readingOrder: entries,
    resources,
  };

  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
}

export function generateToC(entries: ParsedEntry[], distDir: string) {
  const items = entries.map((entry) =>
    h(
      'li',
      h(
        'a',
        { href: path.relative(distDir, entry.target) },
        entry.title || path.basename(entry.target, '.html'),
      ),
    ),
  );
  const toc = h(
    'html',
    h(
      'head',
      h('title', 'Table of Contents'),
      h('link', {
        href: 'manifest.json',
        rel: 'manifest',
        type: 'application/webpub+json',
      }),
    ),
    h('body', h('nav#toc', { role: 'doc-toc' }, h('ul', items))),
  );
  return toHTML(toc);
}

export async function compile({
  entryContextDir,
  workspaceDir,
  manifestPath,
  projectTitle,
  themeIndexes,
  entries,
  projectAuthor,
  language,
  toc,
  cover,
}: MergedConfig): Promise<void> {
  debug('entries', entries);
  debug('themes', themeIndexes);

  for (const entry of entries) {
    // calculate style path
    let style;
    switch (entry?.theme?.type) {
      case 'uri':
        style = entry.theme.location;
        break;
      case 'file':
        style = path.relative(
          path.dirname(entry.target),
          path.join(workspaceDir, 'themes', entry.theme.name),
        );
        break;
      case 'package':
        style = path.relative(
          path.dirname(entry.target),
          path.join(
            workspaceDir,
            'themes',
            'packages',
            entry.theme.name,
            entry.theme.style,
          ),
        );
    }
    if (entry.type === 'markdown') {
      // compile markdown
      const vfile = processMarkdown(entry.source, {
        style,
        title: entry.title,
      });
      const compiledEntry = String(vfile);
      fs.writeFileSync(entry.target, compiledEntry);
    }
  }

  // copy theme
  const themeRoot = path.join(workspaceDir, 'themes');
  shelljs.mkdir('-p', path.join(themeRoot, 'packages'));
  for (const theme of themeIndexes) {
    switch (theme.type) {
      case 'file':
        shelljs.cp(theme.location, themeRoot);
        break;
      case 'package':
        const target = path.join(themeRoot, 'packages', theme.name);
        shelljs.mkdir('-p', target);
        shelljs.cp('-r', path.join(theme.location, '*'), target);
    }
  }

  // generate manifest
  generateManifest(manifestPath, {
    title: projectTitle,
    author: projectAuthor,
    language,
    toc,
    cover,
    entries: entries.map((entry) => ({
      title: entry.title,
      path: path.relative(workspaceDir, entry.target),
    })),
    modified: new Date().toISOString(),
  });

  // generate toc
  if (toc) {
    const distTocPath = path.join(workspaceDir, 'toc.html');
    if (typeof toc === 'string') {
      shelljs.cp(contextResolve(entryContextDir, toc)!, distTocPath);
    } else {
      const tocString = generateToC(entries, workspaceDir);
      fs.writeFileSync(distTocPath, tocString);
    }
  }
}
