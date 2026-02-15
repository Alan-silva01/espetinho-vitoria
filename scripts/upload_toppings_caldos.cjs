const fs = require('fs');
const path = require('path');
const https = require('https');

const cloudName = 'dhlmg4odx';
const uploadPreset = 'espetinho-vitoria';
const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

const files = [
    {
        path: '/Users/alanferreiradasilva/.gemini/antigravity/brain/3706bb14-a6cd-4475-9f60-34c40018d0a3/topping_torrada_1771187744185.png',
        name: 'topping_torrada.png'
    },
    {
        path: '/Users/alanferreiradasilva/.gemini/antigravity/brain/3706bb14-a6cd-4475-9f60-34c40018d0a3/topping_ovo_cozido_1771187757105.png',
        name: 'topping_ovo_cozido.png'
    }
];

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
        req.write(`Content-Disposition: form-data; name="folder"\r\n\r\nacompanhamentos\r\n`);
        req.write(`--${boundary}--\r\n`);
        req.end();
    });
}

async function main() {
    for (const file of files) {
        console.log(`Uploading ${file.name}...`);
        try {
            const url = await uploadFile(file.path, file.name);
            console.log(`✅ ${file.name}: ${url}`);
        } catch (e) {
            console.error(`❌ Error uploading ${file.name}:`, e.message);
        }
    }
}

main();
