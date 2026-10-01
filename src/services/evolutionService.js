/**
 * Serviço para gerenciar a instância do WhatsApp via Evolution API.
 * Permite verificar status, gerar QR Code e desconectar diretamente do painel admin.
 */

const EVO_BASE_URL = (import.meta.env.VITE_EVOLUTION_API_URL || 'https://intelflux-evolution.pva78e.easypanel.host').replace(/\/$/, '')
const EVO_INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE || 'Espetinho_vitoria'
const EVO_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || ''

const headers = () => ({
    'Content-Type': 'application/json',
    'apikey': EVO_API_KEY
})

async function request(method, path, body = null) {
    try {
        const res = await fetch(`${EVO_BASE_URL}${path}`, {
            method,
            headers: headers(),
            ...(body ? { body: JSON.stringify(body) } : {})
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }))
            throw new Error(err?.message || `HTTP ${res.status}`)
        }

        return await res.json()
    } catch (err) {
        console.error(`[EvolutionService] ${method} ${path} falhou:`, err.message)
        throw err
    }
}

export const evolutionService = {
    /**
     * Retorna o estado atual da conexão da instância.
     * Possíveis valores: "open" (conectado), "close" (desconectado), "connecting"
     */
    async getConnectionState() {
        return request('GET', `/instance/connectionState/${EVO_INSTANCE}`)
    },

    /**
     * Solicita a geração do QR Code para reconectar a instância.
     * Retorna { base64: "data:image/png;base64,...", code: "..." }
     */
    async getQrCode() {
        return request('GET', `/instance/connect/${EVO_INSTANCE}`)
    },

    /**
     * Desconecta (logout) a instância do WhatsApp.
     */
    async logout() {
        return request('DELETE', `/instance/logout/${EVO_INSTANCE}`)
    },

    /**
     * Retorna informações gerais da instância.
     */
    async getInstanceInfo() {
        return request('GET', `/instance/fetchInstances?instanceName=${EVO_INSTANCE}`)
    }
}

export default evolutionService
