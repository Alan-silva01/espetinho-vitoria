import { memo } from 'react'
import {
    Timer, Receipt, Trash2,
    Store, Bike, Utensils, RotateCcw,
    Wallet, MessageSquare, MoreVertical
} from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

import {
    SkewerIcon,
    DrinkGlassIcon,
    BowlAcaiLineIcon,
    getItemDisplayName,
    getCleanInitial,
    getProductIconPath,
    renderItemProductIcon
} from '../../lib/itemIcons'

const getItemIcon = (item) => {
    return renderItemProductIcon(item, { size: 24, imgClassName: 'card-ref-product-icon-img' })
}

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
    const customerAvatar = order.clientes?.avatr_url || order.clientes?.avatar_url || null
    const customerInitial = getCleanInitial(order.nome_cliente)

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, order.id)}
            onDragEnd={onDragEnd}
            onTouchStart={(e) => onTouchStart(e, order.id)}
            onTouchMove={onTouchMove}
            onTouchEnd={(e) => {
                const touch = e.changedTouches[0]
                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY)
                const column = targetElement?.closest('.kanban-col')
                if (column) {
                    const targetStage = column.getAttribute('data-stage')
                    if (targetStage && targetStage !== order.status) {
                        const allowed = validTransitions[order.status] || []
                        if (allowed.includes(targetStage)) {
                            onStatusChange(order.id, targetStage)
                        }
                    }
                }
                onTouchEnd(e)
            }}
            className={`order-card-ref-exact ${order.status === 'cancelado' ? 'cancelled' : ''}`}
            onClick={() => onSelect(order)}
        >
            {/* Header: Foto com status verde + Nome + Pedido + Tempo + Tag Entrega abaixo + 3 pontos à direita */}
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
                    <p className="card-ref-order-id">
                        Pedido: {order.numero_pedido}
                    </p>
                    <div className="card-ref-time-row">
                        <Timer size={13} className="card-ref-clock-icon" />
                        <span>{formatMinutesAgo(order.criado_em, getMinutesAgo)}</span>
                    </div>

                    <div className="card-ref-delivery-row">
                        <span className={`card-ref-type-clean ${order.tipo_pedido}`}>
                            {order.tipo_pedido === 'entrega' ? <Bike size={13} /> : order.tipo_pedido === 'mesa' ? <Utensils size={13} /> : <Store size={13} />}
                            <span>{order.tipo_pedido === 'mesa' ? (order.mesas ? `Mesa ${order.mesas.numero}` : 'Mesa') : order.tipo_pedido === 'entrega' ? 'Entrega' : 'Retirada'}</span>
                        </span>
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

            {/* Lista dos Itens: Ícone de linha preta + Quantidade em negrito + Nome do Produto + Subtítulo */}
            <div className="card-ref-items-list">
                {order.itens?.map((item, idx) => {
                    const subtitle = getItemSubtitle(item)
                    return (
                        <div key={idx} className="card-ref-item-row">
                            <div className="card-ref-item-icon">
                                {getItemIcon(item)}
                            </div>
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

            {/* Rodapé: Carteira + R$ 27,00 (Preço em negrito grande) + Botão "Ver detalhes" + Botão Lixeira */}
            <div className="card-ref-footer">
                <div className="card-ref-price-group">
                    <Wallet size={22} className="card-ref-wallet-icon" />
                    <span className="card-ref-price-val">
                        {formatCurrency(order.valor_total)}
                    </span>
                </div>

                <div className="card-ref-footer-buttons">
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

        </div>
    )
})

export default KanbanOrderCard
