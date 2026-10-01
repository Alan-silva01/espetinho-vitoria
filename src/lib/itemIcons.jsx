import { getSmartItemName } from './utils'

// Ícone preciso de Espetinho (Skewer) com pedaços de carne e cabo
export function SkewerIcon({ size = 26, color = '#1e293b' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 20L20 4" />
            <path d="M7 17l2-2c.8-.8.8-2 0-2.8l-.2-.2c-.8-.8-2-.8-2.8 0l-2 2c-.8.8-.8 2 0 2.8l.2.2c.8.8 2 .8 2.8 0z" />
            <path d="M12 12l2-2c.8-.8.8-2 0-2.8l-.2-.2c-.8-.8-2-.8-2.8 0l-2 2c-.8.8-.8 2 0 2.8l.2.2c.8.8 2 .8 2.8 0z" />
            <path d="M17 7l2-2c.8-.8.8-2 0-2.8l-.2-.2c-.8-.8-2-.8-2.8 0l-2 2c-.8.8-.8 2 0 2.8l.2.2c.8.8 2 .8 2.8 0z" />
        </svg>
    )
}

// Ícone de Copo com Canudo e rodela de fruta (Suco / Bebida) fiel à referência
export function DrinkGlassIcon({ size = 26, color = '#1e293b' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 8l1.5 12.5c.2 1.4 1.4 2.5 2.8 2.5h1.4c1.4 0 2.6-1.1 2.8-2.5L17 8H7z" />
            <path d="M8 12h8" />
            <path d="M13 3l-1 5" />
            <path d="M15 1l-2 2" />
            <path d="M17 7a3 3 0 1 0 0-4 3 3 0 0 0 0 4z" />
        </svg>
    )
}

// Ícone de Tigela com colher (Açaí) em formato line-art
export function BowlAcaiLineIcon({ size = 26, color = '#1e293b' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 11a8 8 0 0 0 16 0H4z" />
            <path d="M8 19v2" />
            <path d="M16 19v2" />
            <path d="M10 21h4" />
            <path d="M17 5l-4 6" />
            <circle cx="18" cy="4" r="1.5" />
        </svg>
    )
}

export const getItemDisplayName = (item) => {
    return getSmartItemName(
        item?.produtos?.nome,
        item?.variacoes_produto?.nome,
        item?.personalizacao
    )
}

export const getCleanInitial = (name) => {
    if (!name || typeof name !== 'string') return 'C'
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const match = normalized.match(/[a-zA-Z]/)
    return match ? match[0].toUpperCase() : 'C'
}

// Mapeamento inteligente de ícones locais para produtos e suas variações
export const getProductIconPath = (item) => {
    const nome = (item?.produtos?.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const varNome = (item?.variacoes_produto?.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const smartName = (getItemDisplayName(item) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const cat = (item?.produtos?.categorias?.nome || item?.produtos?.categoria?.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Inclui valores da personalizacao (ex: Tamanho: "1 Litro", Sabor: "Coca-Cola")
    const personStr = (item?.personalizacao && typeof item.personalizacao === 'object')
        ? Object.values(item.personalizacao).filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : ''

    const fullStr = `${nome} ${varNome} ${smartName} ${cat} ${personStr}`

    // 1. REFRIGERANTES (COCA E FANTA)
    if (fullStr.includes('coca')) {
        if (fullStr.includes('garrafa') || fullStr.includes('litro') || fullStr.includes('1l') || fullStr.includes('2l') || fullStr.includes('1.5') || fullStr.includes('pet')) {
            return '/icons/coca-garrafa.png'
        }
        // Lata, zero, tradicional
        return '/icons/coca-lata.png'
    }
    if (fullStr.includes('fanta')) {
        if (fullStr.includes('garrafa') || fullStr.includes('litro') || fullStr.includes('1l') || fullStr.includes('2l') || fullStr.includes('pet')) {
            return '/icons/fanta-garrafa.png'
        }
        return '/icons/fanta-lata.png'
    }
    if (fullStr.includes('refrigerante') || fullStr.includes('guarana') || fullStr.includes('sprite') || fullStr.includes('pepsi') || fullStr.includes('kuat') || fullStr.includes('bare')) {
        if (fullStr.includes('garrafa') || fullStr.includes('litro') || fullStr.includes('pet')) {
            return '/icons/coca-garrafa.png'
        }
        return '/icons/coca-lata.png'
    }

    // 2. SUCOS (JARRAS, COPOS, POLPAS)
    if (fullStr.includes('jarra')) {
        if (fullStr.includes('acerola')) return '/icons/jarra-acerola.png'
        if (fullStr.includes('caja')) return '/icons/jarra-caja.png'
        if (fullStr.includes('caju')) return '/icons/jarra-caju.png'
        return '/icons/jarra-caju.png'
    }
    if (fullStr.includes('suco') || fullStr.includes('polpa')) {
        if (fullStr.includes('acerola')) return '/icons/copo-acerola.png'
        if (fullStr.includes('caja')) return '/icons/copo-caja.png'
        if (fullStr.includes('caju')) return '/icons/copo-caju.png'
        if (fullStr.includes('laranja')) return '/icons/copo-caja.png'
        if (fullStr.includes('polpa')) return '/icons/polpa.png'
        return '/icons/copo-caju.png'
    }

    // 3. AÇAÍ (ESPECIAL, TRADICIONAL, FELICIDADE)
    if (fullStr.includes('acai')) {
        if (fullStr.includes('especial')) return '/icons/acai especial.png'
        if (fullStr.includes('felicidade')) return '/icons/acai-felicidsade.png'
        if (fullStr.includes('trad')) return '/icons/acai-trad.png'
        return '/icons/acai-trad.png'
    }

    // 4. CALDOS
    if (fullStr.includes('caldo')) {
        if (fullStr.includes('frango')) return '/icons/caldo-frango.png'
        return '/icons/caldo-carne.png'
    }

    // 5. ESPETINHOS / MEDALHÕES
    // Misto de 3 (carne, frango, linguiça)
    if ((fullStr.includes('carne') || fullStr.includes('carn')) && fullStr.includes('frang') && (fullStr.includes('ling') || fullStr.includes('calabresa'))) {
        return '/icons/carn-frang-ling.png'
    }
    // Carne com Linguiça
    if ((fullStr.includes('carne') || fullStr.includes('carn')) && (fullStr.includes('ling') || fullStr.includes('calabresa'))) {
        return '/icons/carne-ling.png'
    }
    // Medalhão
    if (fullStr.includes('medalhao') || fullStr.includes('med')) {
        if (fullStr.includes('frango')) return '/icons/med-frango.png'
        return '/icons/med-carne.png'
    }
    // Frango
    if (fullStr.includes('frango') || fullStr.includes('asa') || fullStr.includes('coracao')) {
        return '/icons/frango.png'
    }
    // Carne / Padrão Espeto
    if (fullStr.includes('carne') || fullStr.includes('alcatra') || fullStr.includes('picanha') || fullStr.includes('cupim') || fullStr.includes('espet')) {
        return '/icons/carne.png'
    }

    return null
}

export const renderItemProductIcon = (item, { size = 26, imgClassName = 'card-ref-product-icon-img' } = {}) => {
    const iconPath = getProductIconPath(item)
    if (iconPath) {
        return (
            <img
                src={iconPath}
                alt=""
                className={imgClassName}
                onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = 'flex'
                    }
                }}
            />
        )
    }

    // Fallback para biblioteca caso não corresponda a nenhum icon dos arquivos
    const cat = (item?.produtos?.categorias?.nome || item?.produtos?.categoria?.nome || '').toLowerCase()
    const nome = (item?.produtos?.nome || '').toLowerCase()
    const smartName = (getItemDisplayName(item) || '').toLowerCase()

    if (cat.includes('açai') || cat.includes('açaí') || cat.includes('acai') || nome.includes('açaí') || nome.includes('acai') || smartName.includes('açaí') || smartName.includes('acai')) {
        return <BowlAcaiLineIcon size={size} color="#0f172a" />
    }
    if (cat.includes('bebida') || cat.includes('suco') || cat.includes('refri') || nome.includes('suco') || nome.includes('refri') || nome.includes('coca') || nome.includes('cerveja') || smartName.includes('suco') || smartName.includes('refri')) {
        return <DrinkGlassIcon size={size} color="#0f172a" />
    }
    return <SkewerIcon size={size} color="#0f172a" />
}
