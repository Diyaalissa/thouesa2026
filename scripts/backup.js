const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbName = process.env.DB_NAME || 'thouesa';
const dbHost = process.env.DB_HOST || 'localhost';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${dbName}-${timestamp}.sql`);

// Note: mysqldump needs to be installed on the system
const command = `mysqldump -h ${dbHost} -u ${dbUser} ${dbPass ? `-p${dbPass}` : ''} ${dbName} > ${backupFile}`;

console.log(`Starting backup of ${dbName}...`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Backup failed: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Backup stderr: ${stderr}`);
    }
    console.log(`Backup successful: ${backupFile}`);
});
