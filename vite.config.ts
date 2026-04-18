import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const vercelApiMock = (env: Record<string, string>) => {
  return {
    name: 'vercel-api-mock',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/azuracast/nowplaying') {
          try {
            const response = await fetch('https://radio.finwuh.uk/api/nowplaying/1');
            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({error: e.message}));
          }
          return;
        }

        if (req.url?.startsWith('/api/lastfm/art') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const artist = parsedUrl.searchParams.get('artist');
            const track = parsedUrl.searchParams.get('track');

            if (!artist || !track || !env.LASTFM_API_KEY) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ art: null }));
              return;
            }

            const params = new URLSearchParams({
              method: 'track.getInfo',
              artist,
              track,
              autocorrect: '1',
              format: 'json',
              api_key: env.LASTFM_API_KEY
            });

            const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
            const data = await response.json();
            const images = data?.track?.album?.image;
            const largestImage = Array.isArray(images)
              ? images.map((image: any) => image?.['#text']).filter(Boolean).pop() || null
              : null;

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ art: largestImage }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ art: null, error: e.message }));
          }
          return;
        }

        if (req.url === '/api/fetch-article-metadata' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed.url) throw new Error('URL required');
              const response = await fetch(parsed.url);
              const html = await response.text();
              const cheerio = await import('cheerio');
              const $ = cheerio.load(html);
              const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
              const image = $('meta[property="og:image"]').attr('content') || '';
              const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ title, image, description }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({error: e.message}));
            }
          });
          return;
        }
        
        next();
      });
    }
  }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        vercelApiMock(env),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
