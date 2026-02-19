# Deploy to Vercel

## 1. Push to GitHub

```bash
cd ~/code/twitter-bookmarks-server
git init
git add .
git commit -m "Initial commit: Twitter bookmarks OAuth server"
git remote add origin https://github.com/YOUR_USERNAME/twitter-bookmarks-server
git push -u origin main
```

## 2. Deploy to Vercel

```bash
vercel
```

Follow prompts to connect GitHub repo and deploy.

## 3. Set Environment Variables

In Vercel dashboard:
- Go to Settings → Environment Variables
- Add:
  - `TWITTER_CLIENT_ID` = your API Key
  - `TWITTER_CLIENT_SECRET` = your API Secret
  - `REDIRECT_URI` = `https://your-project.vercel.app/callback`

**Update Redirect URI in X Developer Portal:**
- Go to https://developer.twitter.com/en/portal/dashboard
- App Settings → Auth Settings
- Update Redirect URI to match: `https://your-project.vercel.app/callback`

## 4. (Optional) Add Vercel KV for Persistent Storage

In Vercel dashboard:
- Go to Storage → Create Database (KV)
- It will auto-add `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

This stores tokens persistently so they survive redeploys.

## 5. Update CLI

Edit your python CLI or use curl:

```bash
# Get bookmarks from deployed server
curl https://your-project.vercel.app/bookmarks?limit=10

# First time: visit to authenticate
open https://your-project.vercel.app/login
```

## Done!

Your bookmarks endpoint is now always available at:
```
https://your-project.vercel.app/bookmarks?limit=10
```
