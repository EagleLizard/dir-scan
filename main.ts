
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
import path, { ParsedPath } from 'path';
import { promisify } from 'util';
import fs, { Dirent, Stats, WriteStream } from 'fs';
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

import _rimraf from 'rimraf';
const rimraf = promisify(_rimraf);

import { getIntuitiveByteConversion } from './lib/math-util';

const CURRENT_DIR = path.resolve(path.join(__dirname, '..'));

const DEPS_SKIP_DIRS = [
  CURRENT_DIR,
  '/private/var/db/',
  '/private/var/folders/',
  '/private/var/vm/',
  // '/Dropbox/',
  '/.vscode/',
  '/Google/Chrome/',
];

const ALL_SKIP_DIRS: string[] = [
  CURRENT_DIR,
  '/Google/Chrome/Default/Local Storage/',
  '/Google/Chrome/Default/Local Extension Settings/',
  '/private/var/db/',
  '/private/var/folders/',
  '/private/var/vm/',
  '/Google/Chrome/Default/Cache/',
];

const ERROR_SKIP_CODES = [
  'EACCES',
  'EPERM',
  'EBADF',
];

import { dirExists } from './lib/files';

const argv = process.argv.slice(2);

(async () => {
  try {
    main(argv);
  } catch(e) {
    console.error(e);
    throw e;
  }
})();

async function main(argv: string[]) {
  await scanNodeModules(argv);
  // await scanAll(argv);
  // dirFilePaths.forEach(filePath => {
  //   process.stdout.write(`${filePath}\n`);
  // });

  // await cleanDeps(argv[0]);
}

async function scanAll(argv: string[]) {
  let isDir: boolean;
  let startMs: number, endMs: number, fileCount: number, foundCount: number;
  let bytesSum: number;
  let writeStream: WriteStream;
  writeStream = fs.createWriteStream(path.join(CURRENT_DIR, 'found-files.txt'));

  isDir = await dirExists(argv[0]);
  if(!isDir) {
    throw new Error(`Directory doesn't exist or isn't accessible: ${argv[0]}`);
  }
  fileCount = 0;
  foundCount = 0;
  bytesSum = 0;

  startMs = Date.now();
  process.stdout.write('\n');
  await scanDir(argv[0], {}, async (baseDir, dirent, fileStats) => {
    let fileSize: number;
    let filePath: string;
    filePath = path.join(baseDir, dirent.name);
    fileCount++;
    if((fileCount % 1e2) === 0) {
      process.stdout.write('.');
    }
    for(let k = 0, currSkipDir: string; currSkipDir = ALL_SKIP_DIRS[k], k < ALL_SKIP_DIRS.length; ++k) {
      if(filePath.includes(`${currSkipDir}`)) {
        return true;
      }
    }
    if(dirent.isFile()) {
      fileSize = (fileStats as Stats)?.size ?? 0;
      bytesSum = bytesSum + fileSize;
      if(bytesSum > Number.MAX_SAFE_INTEGER) {
        throw new Error('Bytes sum exceeded integer limit');
      }
      // fileSizes.push(fileSize);
      foundCount++;
      writeStream.write(`${filePath}\n`);
      // process.stdout.write(`${baseDir} ${fileSizeKb.toFixed(2)}kb\n`);
    }
    return false;
  });
  writeStream.close();
  process.stdout.write('\n');
  endMs = Date.now();
  const [ byteOrder, byteConversion ] = getIntuitiveByteConversion(bytesSum);
  console.log(`Scanned ${fileCount.toLocaleString()} files in ${endMs - startMs}ms`);
  console.log(`Found ${foundCount.toLocaleString()} matching files`);
  console.log(`Total size of found files: ${(+byteConversion.toFixed(3)).toLocaleString()} ${byteOrder}`);
}

async function scanNodeModules(argv: string[]) {
  let isDir: boolean;
  let startMs: number, endMs: number, fileCount: number, foundCount: number;
  let bytesSum: number, totalMb: number;
  let writeStream: WriteStream;
  writeStream = fs.createWriteStream(path.join(CURRENT_DIR, 'found-deps.txt'));

  isDir = await dirExists(argv[0]);
  if(!isDir) {
    throw new Error(`Directory doesn't exist or isn't accessible: ${argv[0]}`);
  }

  // let printInterval = 1e3;
  let printInterval = 1e3;

  fileCount = 0;
  foundCount = 0;
  bytesSum = 0;
  startMs = Date.now();
  process.stdout.write('\n');
  await scanDir(argv[0], { pathMatch: '/node_modules/' }, async (baseDir, dirent, fileStats) => {
    let fileSize: number;
    let filePath: string;
    filePath = path.join(baseDir, dirent.name);
    fileCount++;

    // if((foundCount % printInterval) === 0) {
    //   process.stdout.write('.');
    // }

    for(let k = 0, currSkipDir: string; currSkipDir = DEPS_SKIP_DIRS[k], k < DEPS_SKIP_DIRS.length; ++k) {
      if(filePath.includes(`${currSkipDir}`)) {
        return true;
      }
    }
    if(baseDir.includes('/node_modules/')) {
      if(dirent.isFile()) {
        // fileStats = await stat(baseDir);
        fileSize = (fileStats as Stats)?.size ?? 0;
        bytesSum = bytesSum + fileSize;
        if(bytesSum > Number.MAX_SAFE_INTEGER) {
          throw new Error('Bytes sum exceeded integer limit');
        }
        // fileSizes.push(fileSize);
        foundCount++;
        writeStream.write(`${filePath}\n`);
        // process.stdout.write('.');
      }
    }
    if((fileCount % printInterval) === 0) {
      queueMicrotask(() => {
        process.stdout.write('.');
      });
    }
    return false;
  });
  process.stdout.write('\n');
  writeStream.close();
  endMs = Date.now();
  totalMb = bytesSum / 1024 / 1024;
  const [ byteOrder, byteConversion ] = getIntuitiveByteConversion(bytesSum);
  console.log(`Scanned ${fileCount.toLocaleString()} files in ${endMs - startMs}ms`);
  console.log(`Found ${foundCount.toLocaleString()} matching files`);
  console.log(`Total size of found files: ${(+byteConversion.toFixed(3)).toLocaleString()} ${byteOrder}`);
}

interface ScanDirOptions {
  pathMatch?: string,
}

async function scanDir(dirPath: string, options: ScanDirOptions, direntCb: (basePath: string, fsDirent: Dirent, fStats: Stats | void) => Promise<boolean>) {
  let dirents: Dirent[];
  let scanPromises: Promise<void>[];
  try {
    dirents = await readdir(dirPath, {
      withFileTypes: true,
    });
  } catch(e) {
    console.error((new Error).stack);
    if(ERROR_SKIP_CODES.includes(e?.code)) {
      console.error(e);
      return;
    }
    throw e;
  }
  scanPromises = [];
  for(let i = 0, dirent: Dirent; dirent = dirents[i], i < dirents.length; ++i) {
    let statPromise: Promise<Stats | void>, scanPromise: Promise<void>;
    let fullPath: string;
    fullPath = path.join(dirPath, dirent.name);
    if(
      (options.pathMatch !== undefined)
      && fullPath.includes(options.pathMatch)
      && dirent.isFile()
    ) {
      statPromise = stat(fullPath);
    } else {
      statPromise = Promise.resolve();
    }
    scanPromise = statPromise.then(_stat => {
      return direntCb(dirPath, dirent, _stat).then(doSkip => {
        if((doSkip !== true) && dirent.isDirectory()) {
          return scanDir(fullPath, options, direntCb);
        }
      });
    }).catch(err => {
      if(err?.code === 'ENOENT') {
        process.stderr.write('\n');
        console.error(err);
        process.stderr.write('\n');
      } else {
        console.error((new Error).stack);
        throw err;
      }
    });
    scanPromises.push(scanPromise);
  }
  await Promise.all(scanPromises);
}

async function cleanDeps(dirPath: string) {
  const depDirs = await getDepDirs(dirPath);
  for(let i = 0; i < depDirs.length; ++i) {
    await rimraf(depDirs[i]);
  }
}

async function getDepDirs(dirPath: string, soFar?: string[]): Promise<string[]> {
  let dirents: Dirent[], dirs: string[];
  if(soFar === undefined) {
    soFar = [];
  }
  dirents = await readdir(dirPath, {
    withFileTypes: true,
  });
  dirs = dirents
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(dirPath, dirent.name));
  for(let i = 0, dirPath: string; dirPath = dirs[i], i < dirs.length; ++i) {
    let parsedPath: ParsedPath;
    parsedPath = path.parse(dirPath);
    if(parsedPath.name !== 'node_modules') {
      await getDepDirs(dirPath, soFar);
    } else {
      soFar.push(dirPath);
    }
  }
  return soFar;
}
