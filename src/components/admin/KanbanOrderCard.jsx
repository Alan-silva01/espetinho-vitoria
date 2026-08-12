import { memo } from 'react'
import {
    Timer, Receipt, Trash2,
    Store, Bike, Utensils, RotateCcw
} from 'lucide-react'
import { formatCurrency, getSmartItemName } from '../../lib/utils'

const getItemDisplayName = (item) => {
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
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
            className={`order-card-v2 ${order.status === 'cancelado' ? 'cancelled' : (order.status === 'preparando' || order.status === 'pronto') ? 'border-purple' : order.status === 'saiu_entrega' ? 'border-orange' : order.status === 'entregue' ? 'border-green' : ''}`}
            onClick={() => onSelect(order)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`type-tag ${order.tipo_pedido}`}>
                        {order.tipo_pedido === 'entrega' ? <Bike size={12} /> : order.tipo_pedido === 'mesa' ? <Utensils size={12} /> : <Store size={12} />}
                        {order.tipo_pedido === 'mesa' ? (order.mesas ? `Mesa ${order.mesas.numero}` : 'Mesa') : order.tipo_pedido}
                    </span>
                    {order.comanda_status === 'fechamento_solicitado' && order.status !== 'cancelado' && (
                        <span className="pulse-alert" style={{ background: '#f59e0b', color: 'white', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Receipt size={12} />
                            FECHAR CONTA
                        </span>
                    )}
                    {order.status === 'cancelado' && (
                        <span style={{ background: '#DC2626', color: 'white', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CANCELADO</span>
                    )}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Timer size={12} />
                    <span>{getMinutesAgo(order.criado_em)} min atrás</span>
                </div>
            </div>

            <div className="card-title-group">
                <span className="order-id">PEDIDO - {order.numero_pedido}</span>
                <h4 className="customer-name-v2">Cliente: {order.nome_cliente || 'Sem nome'}</h4>
            </div>

            <div className="items-preview" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {order.itens?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{item.quantidade}x </span>
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{getItemDisplayName(item)}</span>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: order.status === 'cancelado' ? '#94a3b8' : '#0f172a', textDecoration: order.status === 'cancelado' ? 'line-through' : 'none' }}>{formatCurrency(order.valor_total)}</span>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {order.status !== 'cancelado' && (
                        <button
                            className="btn-cancel-card"
                            title="Cancelar pedido"
                            onClick={(e) => {
                                e.stopPropagation()
                                onCancel(order)
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {order.status === 'cancelado' ? (
                        <button
                            className="quick-action stage-confirmado"
                            style={{ background: '#10B981', borderColor: '#059669' }}
                            onClick={(e) => {
                                e.stopPropagation()
                                onReactivate(order)
                            }}
                        >
                            <RotateCcw size={14} style={{ marginRight: '4px' }} /> Reativar
                        </button>
                    ) : stage.next && (
                        <button
                            className={`quick-action stage-${stage.next}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextStatus = (order.tipo_pedido === 'mesa' && stage.id === 'preparando') ? 'entregue' : stage.next;
                                onStatusChange(order.id, nextStatus);
                            }}
                        >
                            {
                                stage.id === 'confirmado' ? (
                                    <>
                                        <span className="desktop-btn-label">Iniciar</span>
                                        <span className="mobile-btn-label">Preparar</span>
                                    </>
                                ) : stage.id === 'preparando' ? (
                                    order.tipo_pedido === 'mesa' ? 'Servir' : (
                                        <>
                                            <span className="desktop-btn-label">Enviar</span>
                                            <span className="mobile-btn-label">Saiu p/ Entrega</span>
                                        </>
                                    )
                                ) : stage.id === 'saiu_entrega' ? (
                                    <>
                                        <span className="desktop-btn-label">Concluir</span>
                                        <span className="mobile-btn-label">Entregue</span>
                                    </>
                                ) : 'Iniciar'
                            }
                        </button>
                    )}
                </div>
            </div>

        </div>
    )
})

export default KanbanOrderCard
