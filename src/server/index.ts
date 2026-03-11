import { createApp } from './api.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.API_PORT ?? 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
