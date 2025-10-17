{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/sync-matches",
      "dest": "/api/sync-matches.js"
    },
    {
      "src": "/api/update-logos",
      "dest": "/api/update-logos.js"
    },
    {
      "src": "/api/test-logo",
      "dest": "/api/test-logo.js"
    }
  ],
  "crons": [
    {
      "path": "/api/sync-matches?key=$SECRET_KEY",
      "schedule": "0 6 * * *"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
