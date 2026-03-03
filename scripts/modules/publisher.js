/**
 * Publisher module — clone site repo, write article + images, push.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Publish an article to the site's GitHub repo.
 * @param {object} params
 * @param {object} params.site - Site config (github_repo, domain)
 * @param {object} params.article - Article data (slug, title, content, metaDescription, tags, category)
 * @param {object} params.images - { featured: Buffer|null, additional: [{ type, buffer }] }
 * @returns {{ commit: string, filePath: string, imageUrls: string[] }}
 */
export async function publishToSite({ site, article, images }) {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');
  if (!site.github_repo) throw new Error(`No github_repo configured for site ${site.name}`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'mediaffi-pub-'));
  const repoDir = join(tmpDir, 'repo');

  try {
    // Clone with depth 1 for speed
    const authUrl = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${site.github_repo}.git`;
    execSync(`git clone --depth 1 "${authUrl}" repo`, { cwd: tmpDir, stdio: 'pipe' });

    // Write article markdown
    const articleDir = join(repoDir, 'src', 'content', 'articles');
    mkdirSync(articleDir, { recursive: true });
    const filePath = `src/content/articles/${article.slug}.md`;

    const frontmatter = [
      '---',
      `title: "${article.title.replace(/"/g, '\\"')}"`,
      `description: "${(article.metaDescription || '').replace(/"/g, '\\"')}"`,
      `date: "${new Date().toISOString().split('T')[0]}"`,
      `tags: [${(article.tags || []).map(t => `"${t}"`).join(', ')}]`,
      article.category ? `category: "${article.category}"` : null,
      '---',
    ].filter(Boolean).join('\n');

    writeFileSync(join(repoDir, filePath), `${frontmatter}\n\n${article.content}`);

    // Write images
    const imageUrls = [];
    const imgDir = join(repoDir, 'public', 'images', article.slug);

    if (images?.featured) {
      mkdirSync(imgDir, { recursive: true });
      writeFileSync(join(imgDir, 'featured.png'), images.featured);
      imageUrls.push(`/images/${article.slug}/featured.png`);
    }

    for (const img of images?.additional || []) {
      mkdirSync(imgDir, { recursive: true });
      const name = `${img.type}.png`;
      writeFileSync(join(imgDir, name), img.buffer);
      imageUrls.push(`/images/${article.slug}/${name}`);
    }

    // Git commit and push
    execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
    execSync(`git commit -m "Add article: ${article.slug}"`, { cwd: repoDir, stdio: 'pipe' });
    execSync('git push', { cwd: repoDir, stdio: 'pipe' });

    // Get commit hash
    const commit = execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim();

    console.log(`  ✓ Published: ${filePath} (${commit.slice(0, 7)})`);
    return { commit, filePath, imageUrls };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
