import { memo } from 'react'
import {
    Timer, Receipt, Trash2,
    Store, Bike, Utensils, RotateCcw,
    Wallet, MessageSquare, MoreVertical, X
} from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

import {
    getItemDisplayName,
    getCleanInitial
} from '../../lib/itemIcons'


const formatMinutesAgo = (date, getMinutesAgo) => {
    const rawMinutes = typeof getMinutesAgo === 'function' ? getMinutesAgo(date) : 0
    if (rawMinutes < 60) {
        return `${rawMinutes} min atrás`
    }
    const hours = Math.floor(rawMinutes / 60)
    const mins = rawMinutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')} hr atrás`
}

const getItemSubtitle = (item) => {
    if (item.variacoes_produto?.nome) {
        return item.variacoes_produto.nome
    }
    if (item.personalizacao && typeof item.personalizacao === 'object') {
        const values = Object.values(item.personalizacao).filter(Boolean)
        if (values.length > 0) return values.slice(0, 2).join(' • ')
    }
    return null
}

// Map each stage to the next action
const STAGE_ACTION = {
    confirmado:   { label: 'Preparar',  next: 'preparando'   },
    preparando:   { label: 'Enviar',    next: 'saiu_entrega' },
    saiu_entrega: { label: 'Concluir',  next: 'entregue'     },
}

const KanbanOrderCard = memo(function KanbanOrderCard({
    order,
    stage,
    getMinutesAgo,
    onDragStart,
    onDragEnd,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onSelect,
    onCancel,
    onReactivate,
    onStatusChange,
    validTransitions
}) {
    const action = STAGE_ACTION[order.status] || null
    const customerAvatar = order.clientes?.avatr_url || order.clientes?.avatar_url || null
    const customerInitial = getCleanInitial(order.nome_cliente)

    // No mobile (touch devices), drag is disabled — navigation is button-only
    const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

    return (
        <div
            draggable={!isTouchDevice}
            onDragStart={!isTouchDevice ? (e) => onDragStart(e, order.id) : undefined}
            onDragEnd={!isTouchDevice ? onDragEnd : undefined}
            onTouchStart={(e) => {
                // If user touched a button inside the card, skip drag logic
                if (e.target.closest('button')) return
                onTouchStart(e, order.id)
            }}
            onTouchEnd={(e) => {
                // If user touched a button inside the card, skip drag logic
                if (e.target.closest('button')) return
                onTouchEnd(e)
            }}
            className={`order-card-ref-exact ${order.status === 'cancelado' ? 'cancelled' : ''}`}
            onClick={() => onSelect(order)}
        >
            {/* Faixa preta superior mais larga com número do pedido centralizado */}
            <div className="card-ref-top-bar">
                <span className="card-ref-top-order-num">{order.numero_pedido}</span>
            </div>

            {/* Header: Foto maior com status verde + Nome em linha cheia + Tempo + Linha Entrega/Retirada e Status */}
            <div className="card-ref-header">
                <div className="card-ref-avatar-wrapper">
                    {customerAvatar ? (
                        <img
                            src={customerAvatar}
                            alt={order.nome_cliente || 'Cliente'}
                            className="card-ref-avatar-img"
                        />
                    ) : (
                        <div className="card-ref-avatar-fallback">
                            {customerInitial}
                        </div>
                    )}
                    {/* Indicador de Status Verde Online */}
                    <span className="card-ref-status-dot" />
                </div>

                <div className="card-ref-user-meta">
                    <h4 className="card-ref-customer-name" title={order.nome_cliente || 'Sem nome'}>
                        {order.nome_cliente || 'Sem nome'}
                    </h4>

                    <div className="card-ref-time-row">
                        <Timer size={12} className="card-ref-clock-icon" />
                        <span>{formatMinutesAgo(order.criado_em, getMinutesAgo)}</span>
                    </div>

                    {/* Linha com ENTREGA/RETIRADA e o ícone de status ao lado */}
                    <div className="card-ref-delivery-status-row">
                        <div className="card-ref-delivery-badge-group">
                            <span className={`card-ref-type-caps ${order.tipo_pedido}`}>
                                {order.tipo_pedido === 'mesa' && order.mesas
                                    ? `MESA ${order.mesas.numero}`
                                    : order.tipo_pedido === 'entrega'
                                        ? 'ENTREGA'
                                        : 'RETIRADA'}
                            </span>

                            {/* Somente o ícone ao lado de ENTREGA/RETIRADA na última coluna */}
                            {(stage?.id === 'entregue' || order.status === 'entregue') && (
                                <img
                                    src="/icons/verificado-verde.png"
                                    alt="Concluído"
                                    className="card-ref-status-verified-img"
                                    title="Concluído"
                                />
                            )}
                            {order.status === 'cancelado' && (
                                <span className="card-ref-status-cancel-icon" title="Cancelado">
                                    <X size={12} strokeWidth={2.5} />
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    className="card-ref-menu-btn"
                    title="Opções do pedido"
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect(order)
                    }}
                >
                    <MoreVertical size={18} />
                </button>
            </div>

            {/* Alerta de Fechamento de Comanda se houver */}
            {order.comanda_status === 'fechamento_solicitado' && order.status !== 'cancelado' && (
                <div className="card-ref-alert-banner">
                    <Receipt size={13} />
                    <span>FECHAR CONTA SOLICITADO</span>
                </div>
            )}

            {/* Separador sutil */}
            <div className="card-ref-divider" />

            {/* Lista dos Itens: Quantidade em negrito + Nome do Produto + Subtítulo */}
            <div className="card-ref-items-list">
                {order.itens?.map((item, idx) => {
                    const subtitle = getItemSubtitle(item)
                    return (
                        <div key={idx} className="card-ref-item-row">
                            <div className="card-ref-item-info">
                                <div className="card-ref-item-headline">
                                    <span className="card-ref-item-qty">{item.quantidade}x</span>
                                    <span className="card-ref-item-name">{getItemDisplayName(item)}</span>
                                </div>
                                {subtitle && (
                                    <span className="card-ref-item-subtitle">{subtitle}</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Rodapé: Preço + Botão de Ação + Lixeira */}
            <div className="card-ref-footer">
                <div className="card-ref-price-group">
                    <Wallet size={22} className="card-ref-wallet-icon" />
                    <span className="card-ref-price-val">
                        {formatCurrency(order.valor_total)}
                    </span>
                </div>

                <div className="card-ref-footer-buttons">
                    {/* Botão de avanço de status por coluna */}
                    {action && order.status !== 'cancelado' && (
                        <button
                            className="card-ref-btn-advance"
                            title={action.label}
                            onClick={(e) => {
                                e.stopPropagation()
                                onStatusChange(order.id, action.next)
                            }}
                        >
                            {action.label}
                        </button>
                    )}

                    {order.status !== 'cancelado' && (
                        <button
                            className="card-ref-btn-trash"
                            title="Cancelar pedido"
                            onClick={(e) => {
                                e.stopPropagation()
                                onCancel(order)
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}

                    {order.status === 'cancelado' && (
                        <button
                            className="card-ref-btn-reactivate"
                            title="Reativar pedido"
                            onClick={(e) => {
                                e.stopPropagation()
                                onReactivate(order)
                            }}
                        >
                            <RotateCcw size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* SERRILHADO INFERIOR (ZIGZAG TIPO RECIBO/NOTA) */}
            <div className="card-ref-sawtooth-bottom" aria-hidden="true" />

        </div>
    )
})

export default KanbanOrderCard
