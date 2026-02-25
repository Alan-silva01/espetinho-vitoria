/**
 * Formata valor como moeda brasileira (R$ XX,XX)
 */
export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value || 0)
}

/**
 * Formata data relativa (há X min)
 */
export function timeAgo(date) {
    const now = new Date()
    const past = new Date(date)
    const diffMs = now - past
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMin / 60)

    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `há ${diffMin} min`
    if (diffHour < 24) return `há ${diffHour}h`
    return past.toLocaleDateString('pt-BR')
}

/**
 * Formata telefone brasileiro
 */
export function formatPhone(phone) {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    }
    return phone
}

/**
 * Gera URL da imagem do Supabase Storage
 */
export function getImageUrl(path) {
    if (!path) return null
    if (path.startsWith('http')) return path
    if (path.startsWith('/')) return path
    return `https://vqehwhdlujoajuqunyzu.supabase.co/storage/v1/object/public/imagens-produtos/${path}`
}

/**
 * Status labels em PT-BR
 */
export const STATUS_LABELS = {
    pendente: 'Recebido',
    confirmado: 'Recebido',
    preparando: 'Preparando',
    pronto: 'Pronto',
    saiu_entrega: 'Saiu p/ Entrega',
    entregue: 'Finalizado',
    cancelado: 'Cancelado',
}

export const STATUS_COLORS = {
    pendente: '#F59E0B',
    confirmado: '#3B82F6',
    preparando: '#8B5CF6',
    pronto: '#10B981',
    saiu_entrega: '#F97316',
    entregue: '#22C55E',
    cancelado: '#EF4444',
}

export function getStatusLabel(status, tipoPedido = 'entrega') {
    if (tipoPedido === 'mesa') {
        if (status === 'entregue') return 'Servido'
        if (status === 'confirmado' || status === 'pendente') return 'Recebido'
    }
    if (tipoPedido === 'retirada' && status === 'saiu_entrega') {
        return 'Aguardando Retirada'
    }
    return STATUS_LABELS[status] || status
}

export function getStatusColor(status) {
    return STATUS_COLORS[status] || '#999'
}

/**
 * Debounce function
 */
export function debounce(fn, ms = 300) {
    let timer
    return (...args) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms)
    }
}
/**
 * Normaliza uma string removendo acentos e convertendo para minúsculo
 */
export function normalizeString(str) {
    if (!str) return ''
    return str
        .toLowerCase()
        .normalize('NFD') // Decompõe caracteres acentuados (ex: 'á' -> 'a' + '´')
        .replace(/[\u0300-\u036f]/g, '') // Remove os diacríticos (acentos)
}

/**
 * Filtra a personalização de um item de pedido para exibição limpa.
 *
 * Regras:
 * - Se o nome do item contém "Completo", suprime grupos de inclusão
 *   (tipo "Acompanha", "Incluso", etc.) porque já está tudo incluído.
 * - Se NÃO é completo mas o grupo é de inclusão, mostra apenas os itens
 *   REMOVIDOS como "sem X".
 * - Grupos de add-on (pagos, escolhas) sempre aparecem normalmente.
 *
 * @param {Object} personalizacao - ex: { "Acompanha": ["Arroz","Farofa"], "Molho": "Chimichurri" }
 * @param {string} itemName - nome do item, ex: "Espetinho de Carne - Completo"
 * @param {Array|null} allGroupOptions - lista completa de opções padrão para comparação (opcional)
 * @returns {Array<{key: string, value: string}>} pares filtrados para exibição
 */
export function filterPersonalizacao(personalizacao, itemName) {
    if (!personalizacao || typeof personalizacao !== 'object') return []

    const nameLower = (itemName || '').toLowerCase()
    const isCompleto = nameLower.includes('completo')

    // Groups that represent "what comes with it" (inclusion groups)
    const inclusionKeywords = ['acompanha', 'incluso', 'acompanhamento', 'complemento', 'complementos']

    const result = []

    for (const [key, val] of Object.entries(personalizacao)) {
        const keyLower = key.toLowerCase()
        const isInclusionGroup = inclusionKeywords.some(kw => keyLower.includes(kw))

        if (isInclusionGroup) {
            // "Completo" → skip entirely (all sides are included, no need to list them)
            if (isCompleto) continue

            // Not completo → nothing to show for inclusions either,
            // because the selected items are what the customer chose.
            // The variation name already tells the story (e.g. "Só Carne").
            // We still show the group if it has meaningful content and the name
            // doesn't already describe the selection.
            const displayVal = Array.isArray(val) ? val.join(', ') : val
            if (!displayVal) continue
            result.push({ key, value: String(displayVal) })
        } else {
            // Non-inclusion group (add-ons, choices, etc.) → always show
            const displayVal = Array.isArray(val) ? val.join(', ') : val
            if (!displayVal) continue
            result.push({ key, value: String(displayVal) })
        }
    }

    return result
}

