const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const getLargestImage = (images = []) => {
  if (!Array.isArray(images)) return null;
  for (let i = images.length - 1; i >= 0; i -= 1) {
    const candidate = images[i]?.['#text'];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const artist = typeof req.query?.artist === 'string' ? req.query.artist : '';
  const track = typeof req.query?.track === 'string' ? req.query.track : '';

  if (!artist || !track) {
    res.status(400).json({ error: 'artist and track are required' });
    return;
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    res.status(200).json({ art: null });
    return;
  }

  try {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      artist,
      track,
      autocorrect: '1',
      format: 'json',
      api_key: apiKey
    });

    const response = await fetch(`${LASTFM_BASE_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Last.fm returned ${response.status}`);
    }

    const data = await response.json();
    const art = getLargestImage(data?.track?.album?.image);
    res.status(200).json({ art: art || null });
  } catch (error) {
    console.error('Last.fm art fetch failed:', error);
    res.status(200).json({ art: null });
  }
}
