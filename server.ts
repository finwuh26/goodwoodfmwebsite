import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

// RSS Feeds for different categories
const RSS_FEEDS: Record<string, string> = {
  world: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  uk: 'http://feeds.bbci.co.uk/news/uk/rss.xml',
  business: 'http://feeds.bbci.co.uk/news/business/rss.xml',
  technology: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  entertainment: 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
  health: 'http://feeds.bbci.co.uk/news/health/rss.xml',
  science: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
};

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/news/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const feedUrl = RSS_FEEDS[category] || RSS_FEEDS['world'];
    
    const feed = await parser.parseURL(feedUrl);
    
    const articles = feed.items.slice(0, 10).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet,
      guid: item.guid,
    }));
    
    res.json({ articles });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.post('/api/fetch-article-metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    
    res.json({ title, image, description, url });
  } catch (error) {
    console.error('Error fetching article metadata:', error);
    res.status(500).json({ error: 'Failed to fetch article metadata' });
  }
});

app.get('/api/azuracast/nowplaying', async (req, res) => {
  try {
     const url = 'https://radio.finwuh.uk';
     const stationId = '1';

     const response = await axios.get(`${url}/api/nowplaying/${stationId}`);
     res.json(response.data);
  } catch (err: any) {
      if (err.response && err.response.status === 404) {
          return res.json({
             station: { listen_url: '' },
             listeners: { total: 0 },
             live: { is_live: false, streamer_name: '' },
             now_playing: { song: { title: 'Radio Offline', artist: 'System', art: '' }, elapsed: 0, duration: 10, remaining: 10 }
          });
      }
      console.error('Radio Fetch error via Azuracast proxy:', err.message, err.response?.data);
      res.status(500).json({ error: 'Failed to fetch radio data' });
  }
});

app.get('/api/azuracast/streamers', async (req, res) => {
  try {
     const url = 'https://radio.finwuh.uk';
     const apiKey = process.env.VITE_AZURACAST_API_KEY || process.env.AZURACAST_API_KEY;
     const stationId = '1';

     if (!apiKey) {
         return res.json({ 
             configured: false, 
             streamers: [],
             serverUrl: url,
             stationId,
             message: 'API Key not configured. Using placeholder details.'
         });
     }

     const response = await axios.get(`${url}/api/station/${stationId}/streamers`, {
         headers: {
             'X-API-Key': apiKey
         }
     });

     res.json({ configured: true, streamers: response.data, serverUrl: url, stationId });
  } catch (err: any) {
      if (err.response && err.response.status === 404) {
          return res.json({ 
             configured: true, 
             streamers: [],
             serverUrl: 'https://radio.finwuh.uk',
             stationId: '1',
             message: 'API Key active but Streamers endpoint failed (404).'
          });
      }
      console.error('Error fetching from Azuracast:', err.message);
      res.status(500).json({ error: 'Failed to connect to AzuraCast' });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
