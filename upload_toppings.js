const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const folder = '/Users/alanferreiradasilva/.gemini/antigravity/brain/8975dbab-1463-4cbd-a3a1-fdce8dc88423';
const cloudName = 'dhlmg4odx';
const uploadPreset = 'espetinho_vitoria_unsigned';
const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

const filesToUpload = {
    "Leite em pó": "topping_leite_po_1771159218837.png",
    "Leite condensado": "topping_leite_condensado_1771159232463.png",
    "Amendoim": "topping_amendoim_v2_1771159287209.png",
    "Tapioca": "topping_tapioca_1771159247183.png",
    "Uva": "topping_uva_1771159261160.png",
    "Kiwi": "topping_kiwi_v3_1771159333576.png",
    "Banana": "topping_banana_v3_1771159347739.png",
    "Granola": "topping_granola_v5_final_ok_1771159435657.png",
    "Morango": "topping_morango_v2_1771159314235.png",
    "Gotas de chocolate": "topping_gotas_choco_v3_final_ok_1771159448557.png",
    "Raspas de chocolate": "topping_raspas_choco_v2_final_1771159368657.png",
    "Choco Ball": "topping_chocoball_final_1771159382389.png",
    "Recheio de chocolate": "topping_recheio_choco_final_1771159395485.png",
    "Recheio de morango": "topping_recheio_morango_final_1771159413351.png"
};

async function uploadFile(filePath, fileName) {
    const boundary = '----CloudinaryBoundary';
    const stats = fs.statSync(filePath);

    return new Promise((resolve, reject) => {
        const req = https.request(cloudinaryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(data);
                }
            });
        });

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="upload_preset"\r\n\r\n${uploadPreset}\r\n`);
        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="folder"\r\n\r\nacompanhamentos\r\n`);
        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
        req.write(`Content-Type: image/png\r\n\r\n`);

        const fileStream = fs.createReadStream(filePath);
        fileStream.on('end', () => {
            req.write(`\r\n--${boundary}--\r\n`);
            req.end();
        });
        fileStream.pipe(req, { end: false });
    });
}

async function main() {
    const results = {};
    for (const [name, fileName] of Object.entries(filesToUpload)) {
        console.log(`Uploading ${name}...`);
        try {
            const data = await uploadFile(path.join(folder, fileName), fileName);
            results[name] = data.secure_url;
            console.log(`Done: ${data.secure_url}`);
        } catch (err) {
            console.error(`Failed ${name}:`, err);
        }
    }
    fs.writeFileSync(path.join(folder, 'upload_results.json'), JSON.stringify(results, null, 2));
}

main();
