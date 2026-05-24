const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load service account credentials from JSON file
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '../../service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Uploads a file buffer to Google Drive.
 * @param {Buffer} buffer - File data.
 * @param {string} filename - Desired file name.
 * @param {string} mimeType - MIME type of the file.
 * @param {string} [folderId] - Drive folder ID where the file will be placed.
 * @returns {Promise<{id:string, webViewLink:string}>}
 */
async function uploadFile(buffer, filename, mimeType, folderId) {
  const fileMetadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined,
  };
  const media = {
    mimeType,
    body: Buffer.isBuffer(buffer) ? Buffer.from(buffer) : fs.createReadStream(buffer),
  };
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink',
  });
  // Make the file publicly readable (optional, adjust permissions as needed)
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  return { id: response.data.id, webViewLink: response.data.webViewLink };
}

module.exports = { uploadFile };
