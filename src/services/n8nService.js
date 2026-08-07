/**
 * Serviço centralizado para disparo de webhooks do N8N.
 * Gerencia a URL base, os cabeçalhos de autenticação e timeouts de requisição.
 */

const N8N_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://intelflux-n8n-webhook.pva78e.easypanel.host/webhook'
const N8N_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || ''

/**
 * Função utilitária genérica para envio de webhooks HTTP POST
 */
async function postWebhook(endpointPath, payload, options = {}) {
    const url = `${N8N_BASE_URL.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    }

    if (N8N_TOKEN) {
        headers['x-webhook-token'] = N8N_TOKEN
    }

    const controller = new AbortController()
    const timeoutMs = options.timeout || 10000
    const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            console.warn(`[N8N Webhook] HTTP ${response.status} ao chamar ${endpointPath}`)
        }

        return response
    } catch (err) {
        clearTimeout(timeoutId)
        console.warn(`[N8N Webhook] Falha ao enviar webhook para ${endpointPath}:`, err?.message || err)
        return null
    }
}

export const n8nService = {
    /**
     * Webhook enviado quando um novo pedido é finalizado no checkout.
     */
    async sendNovoPedido(webhookBody) {
        return postWebhook('/pedido_feito', webhookBody, { timeout: 10000 })
    },

    /**
     * Webhook enviado no painel Admin quando o pedido muda para status "saiu_entrega".
     */
    async sendSaiuEntrega(orderPayload) {
        return postWebhook('/saiu_entrega', orderPayload, { timeout: 10000 })
    },

    /**
     * Webhook enviado no painel Admin ao solicitar envio do link do App via WhatsApp.
     */
    async sendLinkApp({ telefone, codigo }) {
        return postWebhook('/enviar_link', { telefone, codigo }, { timeout: 10000 })
    }
}

export default n8nService
