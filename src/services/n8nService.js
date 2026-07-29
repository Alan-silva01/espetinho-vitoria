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

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(options.timeout || 5000)
        })

        if (!response.ok) {
            console.warn(`[N8N Webhook] HTTP ${response.status} ao chamar ${endpointPath}`)
        }

        return response
    } catch (err) {
        console.warn(`[N8N Webhook] Falha ao enviar webhook para ${endpointPath}:`, err)
        return null
    }
}

export const n8nService = {
    /**
     * Webhook enviado quando um novo pedido é finalizado no checkout.
     */
    async sendNovoPedido(webhookBody) {
        return postWebhook('/pedido_feito', webhookBody, { timeout: 5000 })
    },

    /**
     * Webhook enviado no painel Admin quando o pedido muda para status "saiu_entrega".
     */
    async sendSaiuEntrega(orderPayload) {
        return postWebhook('/saiu_entrega', orderPayload, { timeout: 5000 })
    },

    /**
     * Webhook enviado no painel Admin ao solicitar envio do link do App via WhatsApp.
     */
    async sendLinkApp({ telefone, codigo }) {
        return postWebhook('/enviar_link', { telefone, codigo }, { timeout: 5000 })
    }
}

export default n8nService
