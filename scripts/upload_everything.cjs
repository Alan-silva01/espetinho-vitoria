const fs = require('fs');
const path = require('path');
const https = require('https');

const folder = '/Users/alanferreiradasilva/.gemini/antigravity/brain/8975dbab-1463-4cbd-a3a1-fdce8dc88423';
const cloudName = 'dhlmg4odx';
const uploadPreset = 'espetinho-vitoria';
const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

const outputFile = path.join(folder, 'all_urls.json');

async function uploadFile(filePath, fileName) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        };

        const fileBuffer = fs.readFileSync(filePath);
        const folderName = fileName.startsWith('topping_') ? 'acompanhamentos' : 'produtos';

        const req = https.request(cloudinaryUrl, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.secure_url) resolve(json.secure_url);
                    else reject(new Error(body));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n\r\n`);
        req.write(fileBuffer);
        req.write(`\r\n--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="upload_preset"\r\n\r\n${uploadPreset}\r\n`);
        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="folder"\r\n\r\n${folderName}\r\n`);
        req.write(`--${boundary}--\r\n`);
        req.end();
    });
}

async function main() {
    const files = fs.readdirSync(folder).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    const allUrls = fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile)) : {};

    for (const file of files) {
        if (allUrls[file]) {
            console.log(`Skipping ${file} (already uploaded)`);
            continue;
        }

        console.log(`Uploading ${file}...`);
        try {
            const url = await uploadFile(path.join(folder, file), file);
            allUrls[file] = url;
            console.log(`Done: ${url}`);
            fs.writeFileSync(outputFile, JSON.stringify(allUrls, null, 2));
        } catch (e) {
            console.error(`Error uploading ${file}:`, e.message);
        }
    }
}

main();
