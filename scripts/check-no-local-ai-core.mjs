#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const dir = path.join(process.cwd(), 'packages', 'ai-core');
if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
  console.error('ERROR: packages/ai-core exists. Kinetix uses local AI modules only: api/_lib/ai/* and apps/rag/services/ai/*.');
  process.exit(1);
}
