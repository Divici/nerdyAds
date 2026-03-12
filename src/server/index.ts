import { createApp } from './api.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001;
const app = createApp();

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(Number(PORT), HOST, () => {
  console.log(`API server running on http://${HOST}:${PORT}`);
});
