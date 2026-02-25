import { useState, useEffect, useRef, useCallback } from 'react'
import qz from 'qz-tray'

// Demo signing — allows QZ Tray to work without a paid certificate.
// For production you can buy a certificate from qz.io, but this works fine.
qz.security.setCertificatePromise((resolve) => {
    resolve(
        '-----BEGIN CERTIFICATE-----\n' +
        'MIIECzCCAvOgAwIBAgIJALmyjLHvELRjMA0GCSqGSIb3DQEBCwUAMIGfMQswCQYD\n' +
        'VQQGEwJVUzELMAkGA1UECAwCTlkxETAPBgNVBAcMCE5ldyBZb3JrMRcwFQYDVQQK\n' +
        'DA5RWiBJbmR1c3RyaWVzMRcwFQYDVQQLDA5RWiBJbmR1c3RyaWVzMRkwFwYDVQQD\n' +
        'DBBxemluZHVzdHJpZXMuY29tMSMwIQYJKoZIhvcNAQkBFhRzdXBwb3J0QHF6dHJh\n' +
        'eS5jb20wHhcNMTYwNjA3MDMxMjU0WhcNMjYwNjA1MDMxMjU0WjCBnzELMAkGA1UE\n' +
        'BhMCVVMxCzAJBgNVBAgMAk5ZMREwDwYDVQQHDAhOZXcgWW9yazEXMBUGA1UECgwO\n' +
        'UVogSW5kdXN0cmllczEXMBUGA1UECwwOUVogSW5kdXN0cmllczEZMBcGA1UEAwwQ\n' +
        'cXppbmR1c3RyaWVzLmNvbTEjMCEGCSqGSIb3DQEJARYUc3VwcG9ydEBxenRyYXku\n' +
        'Y29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyOjJ9MUfqhMFumAM\n' +
        'tLPMBxGzVENYrgq6f2LiAQLeRMqp8RkWlRHKVTlsApKcMiAqSn/7OymOFCbnFb2b\n' +
        'PKdn1f6JBzGeKT0Nh0j+bNjx+K+ib6ROTKoBSwl3BGAQA9l9VrIl7NOQCEN4tfU7\n' +
        'VYE01J6VniqILAOFIFLlqe61A+XE/hpv16QSCGaYa3koCm1gbtXIVHXnGjnPxHJ0\n' +
        '0f+FhCXd+CfmZqsQMjz0JWxPErPENjLmLzVStZ2r6Lsnv/d04LmhAGIlXqCcE+pa\n' +
        'kJI1gDOSRG2qrLSYo7StkJm28Iy3bMRzhYCGSVV1JKiyxjGjJaM0JVP+460v9fW7\n' +
        'rG/N1wIDAQABo1AwTjAdBgNVHQ4EFgQUPkSZAMZGJIfWuVTGunm/WMzKhX8wHwYD\n' +
        'VR0jBBgwFoAUPkSZAMZGJIfWuVTGunm/WMzKhX8wDAYDVR0TBAUwAwEB/zANBgkq\n' +
        'hkiG9w0BAQsFAAOCAQEAKmJTVJaqdKXjsbIoYJrKTB7XXQ38YJQT0ZnWp97bkNf3\n' +
        '2YFogBe3YPGRT3MFJBbnbhAYRzNIzF5sA4OuV29ae0KJl8JPKC3UOgLJQAcKqmYo\n' +
        'xD3Z5/Iu+xDB3B1aGGQxfHqfpVCSEWqBBrnoESCnnk/QdkfJhR8yRPl/AB0EELnP\n' +
        'nU1z3OOcMJ+DBBopWknEDlWwdaGrMRxrXvIGTEv/K8HEMV6D9i+JoHyAb/REzM3A\n' +
        'UddCAJfuvO7a3g0RKNtjaeM4v3aVjZRB0VnC6JrcssG5mMFobfLm4IYKfR8MPjvv\n' +
        'VVUA3pXhblg8v9KOS3Msiy5DhVZfGSKawm1tdIEDAQ==\n' +
        '-----END CERTIFICATE-----'
    )
})

// Override the signature to allow unsigned requests for demo mode
qz.security.setSignatureAlgorithm('SHA512')
qz.security.setSignaturePromise((toSign) => {
    return (resolve) => {
        resolve() // Allow unsigned for demo/dev
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

            // Auto-select saved printer if available
            const saved = localStorage.getItem('espetinho_qz_printer')
            if (saved && printerList.includes(saved)) {
                setSelectedPrinter(saved)
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

    // Print HTML silently
    const printHtml = useCallback(async (htmlContent) => {
        if (!qz.websocket.isActive() || !selectedPrinter) {
            return false
        }

        try {
            const config = qz.configs.create(selectedPrinter, {
                margins: { top: 0, right: 0, bottom: 0, left: 0 },
                units: 'mm',
                scaleContent: false,
                rasterize: false
            })

            const data = [{
                type: 'html',
                format: 'plain',
                data: htmlContent,
                options: {
                    pageWidth: 2.28  // ~58mm in inches
                }
            }]

            await qz.print(config, data)
            console.log('[QZ Tray] Impressão enviada com sucesso!')
            return true
        } catch (err) {
            console.error('[QZ Tray] Erro ao imprimir:', err)
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
