require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = require('./app');

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`widgetshop-api listening on port ${port}`);
});
