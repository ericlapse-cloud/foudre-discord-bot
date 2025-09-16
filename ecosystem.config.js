cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'fulgurzone-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // ✅ Sécurité renforcée
    uid: 'discord-bot',
    gid: 'discord-bot',
    cwd: '/home/discord-bot/',
    log_file: '/var/log/pm2/fulgurzone-bot.log',
    out_file: '/var/log/pm2/fulgurzone-bot-out.log',
    error_file: '/var/log/pm2/fulgurzone-bot-error.log'
  }]
}
EOF
