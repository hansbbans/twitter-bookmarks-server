const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Use environment variables for token storage
async function getToken(key) {
  if (key === 'access_token') {
    return process.env.TWITTER_ACCESS_TOKEN_STORED;
  } else if (key === 'refresh_token') {
    return process.env.TWITTER_REFRESH_TOKEN_STORED;
  }
  return null;
}

async function setToken(key, value) {
  // Log instruction to save token to Vercel env vars
  const envName = key === 'access_token' ? 'TWITTER_ACCESS_TOKEN_STORED' : 'TWITTER_REFRESH_TOKEN_STORED';
  console.log(`\n⚠️  SAVE THIS TO VERCEL DASHBOARD:\n${envName}=${value}\n`);
  
  // Also set in current process
  if (key === 'access_token') {
    process.env.TWITTER_ACCESS_TOKEN_STORED = value;
  } else {
    process.env.TWITTER_REFRESH_TOKEN_STORED = value;
  }
}

// X API credentials
const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/callback';

// Generate PKCE code challenge
function generateCodeChallenge() {
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

// Store for current PKCE session
let currentPKCE = {};

// Login endpoint - redirects to X OAuth
app.get('/login', (req, res) => {
  const { codeVerifier, codeChallenge } = generateCodeChallenge();
  currentPKCE = { codeVerifier, codeChallenge };
  
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'tweet.read users.read bookmark.read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  res.redirect(authUrl.toString());
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://twitter.com/2/oauth2/token', {
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code_verifier: currentPKCE.codeVerifier
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const token = tokenResponse.data.access_token;
    const refresh = tokenResponse.data.refresh_token;
    
    // Store tokens in env vars
    await setToken('access_token', token);
    await setToken('refresh_token', refresh);
    
    // Show tokens to user so they can add to Vercel
    const envInstructions = `
      Add these to Vercel Dashboard (Settings → Environment Variables):
      
      TWITTER_ACCESS_TOKEN_STORED=${token}
      TWITTER_REFRESH_TOKEN_STORED=${refresh}
    `;
    
    res.send(`
      <html>
        <body>
          <h1>✅ Authentication Successful!</h1>
          <p>To make bookmarks work permanently, add these env vars to your Vercel project:</p>
          <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">
${envInstructions}
          </pre>
          <p>Then redeploy the project.</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Token exchange failed',
      details: error.response?.data 
    });
  }
});

// Bookmarks endpoint
app.get('/bookmarks', async (req, res) => {
  const token = await getToken('access_token');
  const refresh = await getToken('refresh_token');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Not authenticated. Visit /login first.' 
    });
  }
  
  const maxResults = req.query.limit || 10;
  
  try {
    // Get bookmarks
    const response = await axios.get(
      `https://api.twitter.com/2/users/:id/bookmarks?max_results=${maxResults}&tweet.fields=created_at,public_metrics&user.fields=username,name&expansions=author_id`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'TwitterBookmarksClient/1.0'
        }
      }
    );
    
    // Format response
    const bookmarks = (response.data.data || []).map(tweet => {
      const author = response.data.includes?.users?.find(u => u.id === tweet.author_id);
      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: author ? {
          username: author.username,
          name: author.name
        } : null,
        url: `https://x.com/i/status/${tweet.id}`,
        metrics: tweet.public_metrics
      };
    });
    
    res.json({
      count: bookmarks.length,
      bookmarks
    });
  } catch (error) {
    console.error('Bookmarks fetch failed:', error.response?.data || error.message);
    
    // Try to refresh token if expired
    if (error.response?.status === 401 && refresh) {
      try {
        const refreshResponse = await axios.post('https://twitter.com/2/oauth2/token', {
          refresh_token: refresh,
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        });
        
        const newToken = refreshResponse.data.access_token;
        await setToken('access_token', newToken);
        // Retry the bookmarks request
        return res.redirect(`/bookmarks?limit=${maxResults}`);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError.message);
      }
    }
    
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch bookmarks',
      details: error.response?.data 
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    authenticated: !!accessToken,
    server: 'running',
    bookmarks_endpoint: '/bookmarks?limit=10'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Twitter Bookmarks Server running on http://localhost:${PORT}`);
  console.log(`📖 Visit http://localhost:${PORT}/login to authenticate`);
});
