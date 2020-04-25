module.exports = {
  apps : [{
    name: "digitalstage-server",
    script: "dist/main.js",

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: 'one two',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'node',
      host : 'ocean-node',
      ref  : 'origin/feat/di-application',
      repo : "git@github.com:digital-stage/server.git",
      path : '/node/digitalstage',
      'post-deploy' : 'npm install && npm run build-ts && pm2 reload ecosystem.config.js --env production'
    }
  }
};
