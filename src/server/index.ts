import { createApp } from './api.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001;
const app = createApp();

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
});
