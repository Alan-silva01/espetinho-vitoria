/**
 * Cloudinary Upload Utility
 * 
 * Configure your Cloudinary credentials in .env:
 *   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

/**
 * Upload an image to Cloudinary
 * @param {File} file - The image file to upload
 * @param {object} options - Optional configs
 * @param {string} options.folder - Cloudinary folder (default: 'espetinho-vitoria')
 * @param {function} options.onProgress - Progress callback (0-100)
 * @returns {Promise<{url: string, public_id: string}>}
 */
export async function uploadImage(file, options = {}) {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary não configurado. Adicione VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder', options.folder || 'espetinho-vitoria')

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', UPLOAD_URL)

        if (options.onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    options.onProgress(Math.round((e.loaded / e.total) * 100))
                }
            }
        }

        xhr.onload = () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText)
                resolve({
                    url: data.secure_url,
                    public_id: data.public_id,
                    width: data.width,
                    height: data.height,
                })
            } else {
                reject(new Error('Falha no upload da imagem'))
            }
        }

        xhr.onerror = () => reject(new Error('Erro de conexão ao fazer upload'))
        xhr.send(formData)
    })
}

/**
 * Generate a Cloudinary optimized URL
 * @param {string} url - Original URL (Cloudinary or Supabase)
 * @param {object} transforms - Transformations
 * @returns {string}
 */
export function optimizeUrl(url, { width = 400, height = 300, quality = 'auto' } = {}) {
    if (!url) return url
    if (!CLOUD_NAME) return url // Fallback if no cloud name

    // If it's already a Cloudinary URL, transform it directly
    if (url.includes('cloudinary.com')) {
        return url.replace('/upload/', `/upload/f_auto,q_${quality},w_${width},h_${height},c_fill/`)
    }

    // If it's a Supabase URL or other external URL, use Cloudinary Fetch
    // Fetch URL format: https://res.cloudinary.com/<cloud_name>/image/fetch/<transforms>/<url>
    const baseUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch`
    const transforms = `f_auto,q_${quality},w_${width},h_${height},c_fill`

    // Encode the URL twice if it contains special characters, but usually once is enough for Supabase
    return `${baseUrl}/${transforms}/${encodeURIComponent(url)}`
}

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET)
