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
    return `https://vqehwhdlujoajuqunyzu.supabase.co/storage/v1/object/public/imagens-produtos/${path}`
}

/**
 * Status labels em PT-BR
 */
export const STATUS_LABELS = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    preparando: 'Preparando',
    pronto: 'Pronto',
    saiu_entrega: 'Saiu p/ Entrega',
    entregue: 'Entregue',
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

export function getStatusLabel(status) {
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
