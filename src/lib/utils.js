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
 * Extrai os itens default de um nome de variação com parênteses.
 * Ex: "Completo (Arroz, Farofa, Macarrão, Vinagrete)" → ["arroz", "farofa", "macarrão", "vinagrete"]
 */
function parseVariationDefaults(variationName) {
    if (!variationName) return []
    const match = variationName.match(/\((.+)\)\s*$/)
    if (!match) return []
    return match[1].split(',').map(s => normalizeString(s.trim()))
}

/**
 * Extrai os itens selecionados de um grupo de inclusão da personalização.
 */
function getSelectedInclusionItems(personalizacao) {
    if (!personalizacao || typeof personalizacao !== 'object') return null

    const inclusionKeywords = ['acompanha', 'incluso', 'acompanhamento', 'complemento', 'complementos']

    for (const [key, val] of Object.entries(personalizacao)) {
        const keyLower = key.toLowerCase()
        if (inclusionKeywords.some(kw => keyLower.includes(kw))) {
            const items = Array.isArray(val) ? val : (val ? [val] : [])
            return items.map(s => normalizeString(String(s)))
        }
    }
    return null
}

/**
 * Monta um nome limpo para o item do pedido.
 * Ex: Limpa listas como "Completo Arroz, Farofa..." deixando só "Completo"
 */
export function getSmartItemName(productName, variationName, personalizacao) {
    let baseName = productName || 'Item'

    baseName = baseName
        .replace(/\s*[-–]\s*(Completo|Com .+|Só .+)$/i, '')
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .trim()

    if (!variationName) return baseName

    let cleanVariation = variationName.replace(/\s*\(.*?\)\s*$/, '').trim()

    const lowerVar = cleanVariation.toLowerCase();
    const completoIdx = lowerVar.indexOf('completo');
    if (completoIdx !== -1) {
        cleanVariation = cleanVariation.substring(0, completoIdx + 'completo'.length).trim();
        if (cleanVariation.toLowerCase() === 'completo') cleanVariation = 'Completo';
    }

    return `${baseName} - ${cleanVariation}`
}

export function filterPersonalizacao(personalizacao, itemName) {
    if (!personalizacao || typeof personalizacao !== 'object') return []

    const result = []

    for (const [key, val] of Object.entries(personalizacao)) {
        if (!val || (Array.isArray(val) && val.length === 0)) continue

        const keyLower = key.toLowerCase()
        const isPaid = keyLower.includes('pago')

        // Format value: add "1x" prefix for paid additionals
        let displayVal
        if (Array.isArray(val)) {
            displayVal = isPaid
                ? val.map(v => {
                    const cleanName = String(v).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim()
                    return `1x ${cleanName}`
                }).join(', ')
                : val.join(', ')
        } else {
            const cleanName = String(val).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim()
            displayVal = isPaid ? `1x ${cleanName}` : String(val)
        }

        if (!displayVal) continue

        // Clean group name for better readability
        let displayKey = key
        if (isPaid) {
            displayKey = 'Adicionais Pagos'
        } else if (keyLower.includes('escolha') && (keyLower.includes('fruta') || keyLower.includes('inclus'))) {
            displayKey = 'Frutas Escolhidas (Incluso)'
        }

        result.push({ key: displayKey, value: displayVal })
    }

    return result
}


