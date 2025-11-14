module.exports = {
  apps: [{
    name: "groupify-api",
    script: "server.js",            // your entry file
    env: {
      NODE_ENV: "production",
      PORT: 4005,
      BASE_URL: "https://panel.groupify.gg",

      // Discord OAuth
      DISCORD_CLIENT_ID: "1435750035609489548",
      DISCORD_CLIENT_SECRET: "xrEcbySXW_l3Z6XDl9qcgeTzyxY5GhDs",
      DISCORD_REDIRECT_URI: "https://panel.groupify.gg/api/auth/discord/callback",

      // DB etc
      MONGODB_URI="mongodb+srv://GroupifyV2:h9b7ZFUcxsDqjso1@groupifyv2.ieucvgl.mongodb.net/groupify?retryWrites=true&w=majority&appName=GroupifyV2"
    }
  }]
}
