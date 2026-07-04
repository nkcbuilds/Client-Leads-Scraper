import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '../../../.env');
const localEnv = path.resolve(__dirname, '../../.env');

dotenv.config({ path: rootEnv });
dotenv.config({ path: localEnv });