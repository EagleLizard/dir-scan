import { promisify } from 'util';
import fs from 'fs';
const stat = promisify(fs.stat);

export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await stat(dirPath);
  } catch(e) {
    return false;
  }
  return true;
}
