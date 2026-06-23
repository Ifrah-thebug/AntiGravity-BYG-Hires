/**
 * One-time (or repeatable) CV dedupe: list → unique by content → download locally → upload to clean Drive folder.
 *
 * Setup: see steps in the reply / backend/.env.example (DRIVE_CV_* vars).
 *
 * Usage (from backend/):
 *   node scripts/dedupe-cvs-from-drive.js
 *   node scripts/dedupe-cvs-from-drive.js --dry-run
 *   node scripts/dedupe-cvs-from-drive.js --download-only
 *   node scripts/dedupe-cvs-from-drive.js --no-upload
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { google } = require('googleapis');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const CV_EXTENSIONS = /\.(pdf|doc|docx)$/i;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const DOWNLOAD_ONLY = args.has('--download-only');
const NO_UPLOAD = args.has('--no-upload') || DOWNLOAD_ONLY;
const RECURSIVE = args.has('--recursive') || process.env.DRIVE_CV_RECURSIVE === 'true';

const SOURCE_FOLDER_ID = (
  process.env.DRIVE_CV_SOURCE_FOLDER_ID ||
  process.env.DRIVE_ROOT_FOLDER_ID ||
  ''
).trim();

const DEST_FOLDER_ID = (process.env.DRIVE_CV_DEST_FOLDER_ID || '').trim();

const LOCAL_OUTPUT = path.resolve(
  process.env.DRIVE_CV_LOCAL_OUTPUT ||
    path.join(__dirname, '../../unique-cvs-download')
);

const SERVICE_ACCOUNT_PATH = path.resolve(
  process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, '../service-account.json')
);

function log(...parts) {
  console.log('[dedupe-cvs]', ...parts);
}

function isCvFile(file) {
  const name = String(file.name || '');
  if (CV_MIME_TYPES.has(file.mimeType)) return true;
  if (CV_EXTENSIONS.test(name)) return true;
  return false;
}

function sanitizeFilename(name) {
  return String(name || 'cv')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function createDriveClient() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Service account JSON not found at ${SERVICE_ACCOUNT_PATH}. ` +
        'Set GOOGLE_SERVICE_ACCOUNT_PATH in .env or place service-account.json in backend/.'
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function listChildren(drive, folderId) {
  const files = [];
  let pageToken;
  do {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, createdTime, size, parents)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function listAllFiles(drive, rootFolderId) {
  const all = [];
  const queue = [rootFolderId];

  while (queue.length) {
    const folderId = queue.shift();
    const children = await listChildren(drive, folderId);
    for (const item of children) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        if (RECURSIVE) queue.push(item.id);
        continue;
      }
      if (isCvFile(item)) all.push(item);
    }
  }

  return all;
}

function pickUniqueFiles(files) {
  const sorted = [...files].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
  );

  const seenMd5 = new Set();
  const unique = [];
  const duplicates = [];

  for (const file of sorted) {
    const key = file.md5Checksum || `id:${file.id}`;
    if (seenMd5.has(key)) {
      duplicates.push(file);
      continue;
    }
    seenMd5.add(key);
    unique.push(file);
  }

  return { unique, duplicates };
}

async function downloadFileBuffer(drive, fileId) {
  const { data } = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(data);
}

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function buildDestMd5Index(drive, destFolderId) {
  if (!destFolderId) return new Set();
  const destFiles = await listAllFiles(drive, destFolderId);
  const md5s = new Set();
  for (const f of destFiles) {
    if (f.md5Checksum) md5s.add(f.md5Checksum);
  }
  return md5s;
}

function ensureUniqueLocalPath(dir, filename) {
  const base = sanitizeFilename(filename);
  let candidate = path.join(dir, base);
  if (!fs.existsSync(candidate)) return candidate;

  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

async function uploadToDrive(drive, { buffer, filename, mimeType, folderId }) {
  const { data } = await drive.files.create({
    requestBody: {
      name: sanitizeFilename(filename),
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Buffer.from(buffer),
    },
    fields: 'id, name, webViewLink, md5Checksum',
    supportsAllDrives: true,
  });
  return data;
}

function writeReport(rows) {
  const reportPath = path.join(LOCAL_OUTPUT, `dedupe-report-${Date.now()}.csv`);
  const header = [
    'action',
    'name',
    'drive_id',
    'md5',
    'created_time',
    'local_path',
    'dest_drive_id',
    'note',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      header
        .map((key) => {
          const val = String(row[key] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    );
  }
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

async function main() {
  if (!SOURCE_FOLDER_ID) {
    throw new Error(
      'Set DRIVE_CV_SOURCE_FOLDER_ID in .env (folder with duplicate CVs). ' +
        'Example: 1Gls-QjZRjFb-R8b-qeQQPn6dOJDf5GGo'
    );
  }

  if (!NO_UPLOAD && !DEST_FOLDER_ID) {
    throw new Error(
      'Set DRIVE_CV_DEST_FOLDER_ID in .env (clean folder for unique uploads), ' +
        'or run with --download-only / --no-upload.'
    );
  }

  const drive = createDriveClient();

  log('Source folder:', SOURCE_FOLDER_ID);
  log('Local output:', LOCAL_OUTPUT);
  if (!NO_UPLOAD) log('Dest folder:', DEST_FOLDER_ID);
  log('Recursive:', RECURSIVE);
  if (DRY_RUN) log('DRY RUN — no files written');

  log('Listing CV files...');
  const allFiles = await listAllFiles(drive, SOURCE_FOLDER_ID);
  log(`Found ${allFiles.length} CV file(s) in source.`);

  const { unique, duplicates } = pickUniqueFiles(allFiles);
  log(`Unique: ${unique.length} | Duplicates skipped: ${duplicates.length}`);

  if (!fs.existsSync(LOCAL_OUTPUT) && !DRY_RUN) {
    fs.mkdirSync(LOCAL_OUTPUT, { recursive: true });
  }

  const destMd5Index = NO_UPLOAD ? new Set() : await buildDestMd5Index(drive, DEST_FOLDER_ID);
  const reportRows = [];

  for (const dup of duplicates) {
    reportRows.push({
      action: 'skipped_duplicate',
      name: dup.name,
      drive_id: dup.id,
      md5: dup.md5Checksum || '',
      created_time: dup.createdTime,
      local_path: '',
      dest_drive_id: '',
      note: 'Older or duplicate copy (same md5Checksum)',
    });
  }

  let downloaded = 0;
  let uploaded = 0;
  let uploadSkipped = 0;

  for (const file of unique) {
    const md5 = file.md5Checksum || '';
    let localPath = '';
    let buffer = null;

    if (DRY_RUN) {
      reportRows.push({
        action: 'would_process',
        name: file.name,
        drive_id: file.id,
        md5,
        created_time: file.createdTime,
        local_path: path.join(LOCAL_OUTPUT, sanitizeFilename(file.name)),
        dest_drive_id: '',
        note: 'dry-run',
      });
      continue;
    }

    try {
      buffer = await downloadFileBuffer(drive, file.id);
      const contentKey = md5 || hashBuffer(buffer);

      localPath = ensureUniqueLocalPath(LOCAL_OUTPUT, file.name);
      fs.writeFileSync(localPath, buffer);
      downloaded += 1;
      log('Downloaded:', file.name);

      let destDriveId = '';
      let action = 'downloaded';

      if (!NO_UPLOAD) {
        if (md5 && destMd5Index.has(md5)) {
          uploadSkipped += 1;
          action = 'downloaded_upload_skipped';
          reportRows.push({
            action,
            name: file.name,
            drive_id: file.id,
            md5,
            created_time: file.createdTime,
            local_path: localPath,
            dest_drive_id: '',
            note: 'Already in dest folder (same md5)',
          });
          continue;
        }

        const uploadedFile = await uploadToDrive(drive, {
          buffer,
          filename: file.name,
          mimeType: file.mimeType,
          folderId: DEST_FOLDER_ID,
        });
        uploaded += 1;
        destDriveId = uploadedFile.id;
        if (uploadedFile.md5Checksum) destMd5Index.add(uploadedFile.md5Checksum);
        else if (md5) destMd5Index.add(md5);
        action = 'downloaded_and_uploaded';
        log('Uploaded to dest:', file.name);
      }

      reportRows.push({
        action,
        name: file.name,
        drive_id: file.id,
        md5: md5 || contentKey,
        created_time: file.createdTime,
        local_path: localPath,
        dest_drive_id: destDriveId,
        note: '',
      });
    } catch (err) {
      reportRows.push({
        action: 'error',
        name: file.name,
        drive_id: file.id,
        md5,
        created_time: file.createdTime,
        local_path: localPath,
        dest_drive_id: '',
        note: err?.message || String(err),
      });
      console.error('[dedupe-cvs] Failed:', file.name, err?.message || err);
    }
  }

  if (!DRY_RUN) {
    const reportPath = writeReport(reportRows);
    log('---');
    log('Downloaded:', downloaded);
    if (!NO_UPLOAD) {
      log('Uploaded to Drive:', uploaded);
      log('Upload skipped (already in dest):', uploadSkipped);
    }
    log('Report:', reportPath);
  } else {
    log('Dry run complete. Re-run without --dry-run to download/upload.');
  }
}

main().catch((err) => {
  console.error('[dedupe-cvs] Fatal:', err.message || err);
  process.exit(1);
});
