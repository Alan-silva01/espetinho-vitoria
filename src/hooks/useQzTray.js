import { useState, useEffect, useRef, useCallback } from 'react'
import qz from 'qz-tray'

// ── Self-signed certificate for Espetinho Vitória ──
// This eliminates the authorization popup in QZ Tray.
// The matching certificate must be installed in QZ Tray's trusted certs folder.
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUNPRtdPE4AQlKZGsq/FG093bj1fwwDQYJKoZIhvcNAQEL
BQAwRTEaMBgGA1UEAwwRRXNwZXRpbmhvIFZpdG9yaWExGjAYBgNVBAoMEUVzcGV0
aW5obyBWaXRvcmlhMQswCQYDVQQGEwJCUjAeFw0yNjEwMDQxOTE4NDZaFw0zNjEw
MDExOTE4NDZaMEUxGjAYBgNVBAMMEUVzcGV0aW5obyBWaXRvcmlhMRowGAYDVQQK
DBFFc3BldGluaG8gVml0b3JpYTELMAkGA1UEBhMCQlIwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDNinMq4Q0fy4rB20uby5a8bukpcFl32Qa7XR81ul/g
+hP6SpAHMO8w0K0RurHYTbRmu2mIEJyajgnW0ncX1x/a6ZejlJ1xNYnZTMy7j37J
yKOqR8FLiF1lb1aX42B43FDDk9QVwwQbTnkM0MMbm250pxzq4G5BANFgA1LcsKV/
T+vkcGQU/IImhxcYqP13SNMz81PweTbxqFvkfS4/x6W/9ZBH0KVlXKX9akhPzw2N
GrByFkWegYKCbHLJnTnDRraY2pZKwry9qliF3KG8jOQyajX1MnG0ohjVrbuOuseI
FenI3WR63p7tXY7HpKhvH6NM2mYg0U15fHXNmSj7+a6lAgMBAAGjUzBRMB0GA1Ud
DgQWBBTiCnuiZMCukUF8u0z/neZlQBnBnTAfBgNVHSMEGDAWgBTiCnuiZMCukUF8
u0z/neZlQBnBnTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA+
vT7kAfvaJ8AJApRABO/OzeMcyIZ25c3cru2UokNgs9TLL/HZSPbuMou/fSG0/ITT
rUpTbOIo4BM23RL23VY/+YkD9jCSRSZX0S33kshlJyCrktCvwbBkmDDSzdmRbOJX
CgT5FWNzGiUKswSwM0d1MpMxUvmSQotV03jcX2OuelY/V0Z6Wf/KZIz1sor5LTcF
d6KXehg7Cb5A+vlJ0oPdR+FCXGC8GuYCnvO4SvXVKe0LXpvf/oGjQ6VElRuo7ZdY
aBXHxtsMU/NhxoyjIwSDFGDAFSeyxLJFTaYURxY0Jty8e5ajAFp5JtCHlab0upyw
T+Pb5JmGeU8wbvHtebA7
-----END CERTIFICATE-----`

// Private key for signing — safe for internal POS system (not exposed to public internet)
const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDNinMq4Q0fy4rB
20uby5a8bukpcFl32Qa7XR81ul/g+hP6SpAHMO8w0K0RurHYTbRmu2mIEJyajgnW
0ncX1x/a6ZejlJ1xNYnZTMy7j37JyKOqR8FLiF1lb1aX42B43FDDk9QVwwQbTnkM
0MMbm250pxzq4G5BANFgA1LcsKV/T+vkcGQU/IImhxcYqP13SNMz81PweTbxqFvk
fS4/x6W/9ZBH0KVlXKX9akhPzw2NGrByFkWegYKCbHLJnTnDRraY2pZKwry9qliF
3KG8jOQyajX1MnG0ohjVrbuOuseIFenI3WR63p7tXY7HpKhvH6NM2mYg0U15fHXN
mSj7+a6lAgMBAAECggEAA/Zw3PlExwGmFbG0JfdJWy2qOh3L48cf3Znggakrswsv
OmqYl0LmwaKsS4S1bA2ndjmTwcdMNaCaaPVazW9c0lwhi8pQNMAK/dEAu3b7Q0mm
eiBzBhFFd7CrUzdTg1EAD504gAjn+dzL8abOtCgNe5tDL/YOuhsZbkfyH4YaUrd/
WJnR0OKpToMhQ0pkY3ZZWePziq4Ipkst8ABDwxfAxGGkEdoGsbSH3mfj9F4qdpen
QHz/ZX1J22KwWijs2qN9UtUaEgQQBYaKC7Qng8gKIrs/rLi9oU/1Gg5Opi6v2SKB
c8kVQZtvf5usPSACLrUqjLoeMgLypm+Ny3VOHkrCoQKBgQD+oxlikHnuyO2Q01Rw
5qBwVadblefWxIAZIEG0qQwtUw9x/sJU35+5NrtNX2UO4jYQWH5Nm+sSlz0orzFs
ZUcANrJCZ393GqH0x4TKybbsulKxxkv2T5XgXMB5nDbGH9cJMu9O9qU85HtPTo6G
XU2ZtAq8nrYWXA+0sll0p0yocQKBgQDOpBRdDn5IKVa1SvjUuW+XZchjNHYoshrx
YZ7nbuqBNjZcyukgQQHMRQ+Nk+W5OH6+QqxayTYGbIsGQkeIKY3aLjPlcMKbHwTU
WLFZi34muVs1K6z4ZTuMP+j2EkHypxW6vVSyzldZHGavjusd+TvZmXyBd1bAGqXy
CORpjB1jdQKBgE3135LGyx4plFqP6T17zsk14DxxI/8kQFfxAUzvqNPDp2nuZs8X
fE53jFb/CvDIn2bXwSu/vfP+K/Jl2Qrn4xoUpPUhvOvZUpaf828m3QOTdDgLjzxF
V4zOuPtCsZ5tJygg2RXi++otxfcdBRPsQxL5BYSETxl/bCuVoz/M7PJxAoGADZlc
wbcHdoZJ74psj8tYXbVUF7tHH2yBO2t6Qq7Y/gHsV/T+nKHKlX/iAyY9kw/1v12x
7BOb25ZfG91Wyc46SKaLwcjG9eB3t+XSXhtBBRljuD8UlhBLd/JoyXDwKCD43B5D
qbTMqM+mrl0QehuB5dMlD3wkGGZoj2Iobg3LjVUCgYEAnbmTxIJbebsjGoHvhuan
mff03mUU/kddzz0fB6a+eaQtvQ8xrH491aEIdR4/QdNp0rVJkz/Myw77SMY/QSN8
h1muxd9LdZqU7LJHq1ceGjWp21kPe8PV5lRMzk5vsBehDRRaTklKVW6KFlM1r2B+
gT9+MMY2pmPMXVjcGoTGyEQ=
-----END PRIVATE KEY-----`

// ── Helper: PEM to ArrayBuffer ──
function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN [\w ]+-----/, '')
        .replace(/-----END [\w ]+-----/, '')
        .replace(/\s/g, '')
    const binary = atob(b64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i)
    }
    return buffer.buffer
}

// ── Helper: ArrayBuffer to Base64 ──
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

// ── Import private key using Web Crypto API ──
let cachedCryptoKey = null
async function getSigningKey() {
    if (cachedCryptoKey) return cachedCryptoKey

    const keyData = pemToArrayBuffer(QZ_PRIVATE_KEY)
    cachedCryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
        false,
        ['sign']
    )
    return cachedCryptoKey
}

// ── QZ Tray Security Setup ──
qz.security.setCertificatePromise((resolve) => {
    resolve(QZ_CERTIFICATE)
})

qz.security.setSignatureAlgorithm('SHA512')

qz.security.setSignaturePromise((toSign) => {
    return async (resolve, reject) => {
        try {
            const key = await getSigningKey()
            const data = new TextEncoder().encode(toSign)
            const signature = await crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5',
                key,
                data
            )
            resolve(arrayBufferToBase64(signature))
        } catch (err) {
            console.error('[QZ Tray] Erro ao assinar:', err)
            reject(err)
        }
    }
})

export default function useQzTray() {
    const [connected, setConnected] = useState(false)
    const [printers, setPrinters] = useState([])
    const [selectedPrinter, setSelectedPrinter] = useState(() => {
        return localStorage.getItem('espetinho_qz_printer') || ''
    })
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState(null)
    const connectedRef = useRef(false)

    const connect = useCallback(async () => {
        if (qz.websocket.isActive()) {
            setConnected(true)
            connectedRef.current = true
            return true
        }

        setConnecting(true)
        setError(null)

        try {
            await qz.websocket.connect({ retries: 2, delay: 1 })
            setConnected(true)
            connectedRef.current = true

            // List available printers
            const printerList = await qz.printers.find()
            setPrinters(printerList)
            console.log('[QZ Tray] Conectado! Impressoras:', printerList)

            // Auto-select saved printer if available, or fallback to system default
            const saved = localStorage.getItem('espetinho_qz_printer')
            if (saved && printerList.includes(saved)) {
                setSelectedPrinter(saved)
            } else {
                try {
                    const defaultPrinter = await qz.printers.getDefault()
                    if (defaultPrinter) {
                        setSelectedPrinter(defaultPrinter)
                        localStorage.setItem('espetinho_qz_printer', defaultPrinter)
                        console.log('[QZ Tray] Impressora padrão auto-selecionada:', defaultPrinter)
                    } else if (printerList.length > 0) {
                        setSelectedPrinter(printerList[0])
                        localStorage.setItem('espetinho_qz_printer', printerList[0])
                        console.log('[QZ Tray] Primeira impressora auto-selecionada:', printerList[0])
                    }
                } catch {
                    if (printerList.length > 0) {
                        setSelectedPrinter(printerList[0])
                        localStorage.setItem('espetinho_qz_printer', printerList[0])
                    }
                }
            }

            setConnecting(false)
            return true
        } catch (err) {
            console.warn('[QZ Tray] Não conectado:', err?.message || err)
            setError('QZ Tray não encontrado. Instale e abra o QZ Tray.')
            setConnected(false)
            connectedRef.current = false
            setConnecting(false)
            return false
        }
    }, [])

    const disconnect = useCallback(async () => {
        if (qz.websocket.isActive()) {
            try {
                await qz.websocket.disconnect()
            } catch (e) {
                // ignore
            }
        }
        setConnected(false)
        connectedRef.current = false
    }, [])

    const selectPrinter = useCallback((printerName) => {
        setSelectedPrinter(printerName)
        localStorage.setItem('espetinho_qz_printer', printerName)
    }, [])

    // Print HTML silently via QZ Tray
    const printHtml = useCallback(async (htmlContent) => {
        if (!qz.websocket.isActive() || !selectedPrinter) {
            console.warn('[QZ Tray] Não conectado ou sem impressora selecionada')
            return false
        }

        try {
            const config = qz.configs.create(selectedPrinter, {
                margins: { top: 0, right: 0, bottom: 0, left: 0 },
                units: 'mm',
                scaleContent: false,
                rasterize: true,
                density: 203 // DPI padrão de impressoras térmicas 58mm
            })

            const data = [{
                type: 'html',
                format: 'plain',
                data: htmlContent,
                options: {
                    pageWidth: 58,
                    pageHeight: null, // auto height — prevents vertical clipping
                }
            }]

            await qz.print(config, data)
            console.log('[QZ Tray] ✅ Impressão enviada com sucesso!')
            return true
        } catch (err) {
            console.error('[QZ Tray] ❌ Erro ao imprimir:', err)
            return false
        }
    }, [selectedPrinter])

    // Auto-connect on mount
    useEffect(() => {
        connect()
        return () => {
            // Don't disconnect on unmount — keep the connection alive
        }
    }, [connect])

    return {
        connected,
        connecting,
        printers,
        selectedPrinter,
        selectPrinter,
        connect,
        disconnect,
        printHtml,
        error,
        connectedRef
    }
}
