# Twitter Bookmarks OAuth Server

Simple Node.js server that handles Twitter OAuth 2.0 PKCE flow to expose a `/bookmarks` API endpoint.

## Setup

### 1. Register App with X

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new app (or use existing)
3. Under **Keys and tokens**:
   - Copy **API Key** (Client ID)
   - Copy **API Key Secret** (Client Secret)
4. Under **Auth settings**:
   - Enable **OAuth 2.0**
   - Set **Redirect URI**: `http://localhost:3001/callback`
   - Set **Type of App**: Confidential Client
   - Save changes

### 2. Install & Configure

```bash
cd /Users/Hans/code/twitter-bookmarks-server
cp .env.example .env
```

Edit `.env` with your credentials:
```
TWITTER_CLIENT_ID=your_api_key
TWITTER_CLIENT_SECRET=your_api_secret
REDIRECT_URI=http://localhost:3001/callback
PORT=3001
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Server

```bash
npm start
```

### 5. Authenticate

1. Visit `http://localhost:3001/login`
2. Approve access on X
3. You'll be redirected back - server is now authenticated

### 6. Get Bookmarks

```bash
curl http://localhost:3001/bookmarks?limit=10
```

Or from Python:
```python
import requests
bookmarks = requests.get('http://localhost:3001/bookmarks?limit=10').json()
print(bookmarks)
```

## Integration with CLI

Update `twitter_client.py` to call this server for bookmarks instead of using direct API:

```python
import requests

def get_bookmarks_from_server(max_results=10):
    response = requests.get(
        f'http://localhost:3001/bookmarks?limit={max_results}'
    )
    return response.json()
```

## Status

Check if server is running and authenticated:

```bash
curl http://localhost:3001/status
```

## Notes

- Access tokens are stored in memory (in production, use secure storage)
- Refresh tokens are handled automatically
- Keep your `.env` file secret!
