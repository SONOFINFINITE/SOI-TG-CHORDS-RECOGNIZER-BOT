import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function downloadFile(fileUrl) {
    try {
        const response = await axios({
            method: 'GET',
            url: `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileUrl}`,
            responseType: 'arraybuffer'
        });

        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, `temp_${Date.now()}.mp3`);
        fs.writeFileSync(filePath, response.data);

        return filePath;
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

export function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Successfully deleted file:', filePath);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}
