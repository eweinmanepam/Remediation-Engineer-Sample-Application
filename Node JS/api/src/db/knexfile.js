require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'widgetshop',
    user: process.env.DB_USER || 'widgetshop',
    password: process.env.DB_PASSWORD || 'widgetshop',
  },
  migrations: {
    directory: __dirname + '/migrations',
  },
  seeds: {
    directory: __dirname + '/seeds',
  },
};
