const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const keyPath = path.join(__dirname, '../../glassy-azimuth-499614-b3-1fdedf21d9ba.json');
const folderId = '1Gls-QjZRjFb-R8b-qeQQPn6dOJDf5GGo';

if (!fs.existsSync(keyPath)) {
  console.log('KEY_FILE: missing at', keyPath);
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
console.log('SERVICE_ACCOUNT_EMAIL:', creds.client_email);
console.log('PROJECT_ID:', creds.project_id);

const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

async function main() {
  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });
    console.log('FOLDER_ACCESS: ok');
    console.log('FOLDER_NAME:', meta.data.name);
  } catch (e) {
    console.log('FOLDER_ACCESS: failed');
    console.log('ERROR:', e.message);
    if (e.response?.data) console.log('DETAIL:', JSON.stringify(e.response.data));
  }

  try {
    const list = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 5,
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log('LIST_COUNT_SAMPLE:', (list.data.files || []).length);
    for (const f of list.data.files || []) {
      console.log(' -', f.name);
    }
  } catch (e) {
    console.log('LIST_FAILED:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
