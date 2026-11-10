import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { viteSingleFile } from 'vite-plugin-singlefile';

const shareDefaults = JSON.parse(
  readFileSync(new URL('./src/content/shareDefaults.json', import.meta.url), 'utf8'),
) as { title: string; description: string };

/**
 * WhatsApp, iMessage and other apps build the link preview from <meta> tags
 * in index.html. They do not run JavaScript, so the tags are written into the
 * page when the website is built.
 *
 * The title, description and thumbnail come from the "Sharing" page of the
 * dashboard when the database is reachable during the build, and from the
 * bundled defaults otherwise. The preview therefore refreshes whenever the
 * website is redeployed; everything else on the site updates instantly.
 */

interface ShareMeta {
  title: string;
  description: string;
  image: string;
}

function resolveSiteUrl(env: Record<string, string>): string {
  const candidates = [
    env.VITE_SITE_URL,
    process.env.VITE_SITE_URL,
    process.env.URL, // Netlify
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
    process.env.CF_PAGES_URL, // Cloudflare Pages
  ];
  const found = candidates.find((value) => typeof value === 'string' && /^https?:\/\//.test(value.trim()));
  return found ? found.trim().replace(/\/+$/, '') : '';
}

/**
 * Most hosts serve the website from the top of its address, and nothing needs
 * setting. A website served from a folder, such as GitHub Pages at
 * https://name.github.io/wedding/, must be told that folder with
 * VITE_BASE_PATH=/wedding/ so that pictures, music and /admin are found.
 */
function resolveBasePath(env: Record<string, string>): string {
  const raw = (env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '').trim();
  const folder = raw.replace(/^\/+|\/+$/g, '');
  return folder ? `/${folder}/` : '/';
}

async function loadShareMeta(env: Record<string, string>): Promise<ShareMeta> {
  const fallback: ShareMeta = { ...shareDefaults, image: '' };
  const url = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return fallback;
  try {
    const response = await fetch(`${url}/rest/v1/site_content?id=eq.published&select=content`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return fallback;
    const rows = (await response.json()) as Array<{ content?: { share?: Partial<ShareMeta> } }>;
    const share = rows[0]?.content?.share;
    if (!share) return fallback;
    return {
      title: typeof share.title === 'string' && share.title.trim() ? share.title : fallback.title,
      description:
        typeof share.description === 'string' && share.description.trim() ? share.description : fallback.description,
      image: typeof share.image === 'string' ? share.image : '',
    };
  } catch {
    return fallback;
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A Content Security Policy for the built website. It tells the browser to run
 * scripts only from the website itself, which blocks injected code even if a
 * mistake elsewhere were to let some through. Photographs, music and the
 * database are allowed from any https address, because they live on Supabase.
 * (The two local addresses are only used by the automated tests.)
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://127.0.0.1:* http://localhost:*",
  "media-src 'self' data: blob: https: http://127.0.0.1:* http://localhost:*",
  "font-src 'self' data:",
  "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function socialMeta(env: Record<string, string>, enabled: boolean, base: string): Plugin {
  return {
    name: 'wedding-social-meta',
    async transformIndexHtml(html, context) {
      // The development server and the single-file preview need inline scripts, so the policy is for real builds only.
      const policy = enabled && !context.server ? `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />` : '';
      html = html.replace('<!--security-policy-->', policy);
      const share: ShareMeta = enabled ? await loadShareMeta(env) : { ...shareDefaults, image: '' };
      const siteUrl = enabled ? resolveSiteUrl(env) : '';
      const image = /^https?:\/\//.test(share.image) ? share.image : siteUrl ? `${siteUrl}/og-image.jpg` : `${base}og-image.jpg`;
      if (enabled && !siteUrl && process.env.NODE_ENV === 'production') {
        console.warn(
          '\n[wedding] VITE_SITE_URL is not set. Link previews work best with the full website address, ' +
            'for example VITE_SITE_URL=https://your-site.example\n',
        );
      }
      const title = escapeAttribute(share.title);
      const description = escapeAttribute(share.description);
      const tags = [
        `<title>${title}</title>`,
        `<meta name="description" content="${description}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="en_IN" />`,
        `<meta property="og:site_name" content="${title}" />`,
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${description}" />`,
        siteUrl ? `<meta property="og:url" content="${escapeAttribute(siteUrl)}/" />` : '',
        `<meta property="og:image" content="${escapeAttribute(image)}" />`,
        /^https:\/\//.test(image) ? `<meta property="og:image:secure_url" content="${escapeAttribute(image)}" />` : '',
        /^https?:\/\//.test(share.image)
          ? ''
          : `<meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${title}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title}" />`,
        `<meta name="twitter:description" content="${description}" />`,
        `<meta name="twitter:image" content="${escapeAttribute(image)}" />`,
      ].filter(Boolean);
      return html.replace('<!--social-meta-->', tags.join('\n    '));
    },
  };
}

export default defineConfig(({ mode }) => {
  // "artifact" builds one self-contained preview file with the bundled sample content.
  const isPreviewFile = mode === 'artifact';
  const env = isPreviewFile ? {} : loadEnv(mode, process.cwd(), 'VITE_');

  const base = isPreviewFile ? './' : resolveBasePath(env);

  return {
    base,
    plugins: [react(), socialMeta(env, !isPreviewFile, base), ...(isPreviewFile ? [viteSingleFile()] : [])],
    define: isPreviewFile
      ? {
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
          'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
          'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
        }
      : {},
    build: {
      // Older phones are common among relatives, so the output stays conservative.
      target: ['es2019', 'safari13', 'chrome80', 'firefox78'],
      outDir: isPreviewFile ? 'dist-preview' : 'dist',
      assetsInlineLimit: isPreviewFile ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 900,
    },
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
    },
  };
});
