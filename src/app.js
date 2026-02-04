const express = require('express');
const walletRoutes = require('./wallet/routes');
const authRoutes = require('./auth/routes');

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);

app.listen(3000, () => {
  console.log('Wallet service running on port 3000');
});
