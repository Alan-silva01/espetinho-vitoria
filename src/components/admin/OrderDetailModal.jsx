import {
    X, Timer, Printer, Receipt,
    Bike, ChefHat, GlassWater, IceCreamCone, UtensilsCrossed,
    XCircle, CheckCircle, ArrowRight, RotateCcw, ReceiptText
} from 'lucide-react'
import { formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'

const getItemDisplayName = (item) => {
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
}

export default function OrderDetailModal({
    order,
    onClose,
    onStatusChange,
    onPrint,
    onCancel,
    onReactivate,
    onFinalizeComanda,
    ComandaSummary
}) {
    if (!order) return null

    return (
        <div className="modal-overlay-v4" onClick={onClose}>
            <div className="modal-kitchen-v4" onClick={e => e.stopPropagation()}>
                {/* NEW PREMIUM HEADER */}
                <header className="modal-v5-header">
                    <div className="header-title-group">
                        <div className="header-icon-box">
                            <ReceiptText size={20} />
                        </div>
                        <div className="header-text">
                            <h2>Detalhes do Pedido</h2>
                            <p>Espetinho Vitória</p>
                        </div>
                    </div>
                    <button className="btn-close-v5" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                {/* SUMMARY SECTION */}
                <div className="modal-v5-summary">
                    <div className="summary-main">
                        <div className="summary-id-group">
                            <div className="summary-id-row">
                                <h3>Pedido {order.numero_pedido}</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div className={`status-badge-v5 ${order.status}`}>
                                        <Timer size={14} />
                                        {order.status === 'cancelado' ? 'Cancelado' :
                                            order.status === 'confirmado' ? 'Confirmado' :
                                                order.status === 'preparando' ? 'Em Preparo' :
                                                    order.status === 'saiu_entrega' ? 'Em Entrega' : 'Entregue'}
                                    </div>
                                    {order.comanda_status === 'fechamento_solicitado' && order.status !== 'cancelado' && (
                                        <span className="pulse-alert" style={{ background: '#f59e0b', color: 'white', fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Receipt size={14} />
                                            Solicitou Fechamento
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="summary-meta">
                                {new Date(order.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Cliente: {order.nome_cliente} • {order.tipo_pedido === 'mesa' && order.mesas ? `MESA ${order.mesas.numero}` : order.tipo_pedido?.toUpperCase()}
                            </p>
                        </div>

                        <div className="summary-actions">
                            <button className="btn-v5-secondary" onClick={onPrint}>
                                <Printer size={18} />
                                Imprimir
                            </button>

                            {order.status === 'confirmado' && (
                                <button className="btn-v5-primary" onClick={() => {
                                    onStatusChange(order.id, 'preparando');
                                    onClose();
                                }}>
                                    <ChefHat size={18} />
                                    Mandar p/ Cozinha
                                </button>
                            )}

                            {order.status === 'preparando' && (
                                <button className="btn-v5-primary" onClick={() => {
                                    onStatusChange(order.id, order.tipo_pedido === 'mesa' ? 'entregue' : 'saiu_entrega');
                                    onClose();
                                }}>
                                    <Bike size={18} />
                                    {order.tipo_pedido === 'mesa' ? 'Servir Pedido' : 'Enviar'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* BODY SECTION (ITEMS) */}
                <div className="modal-v5-body">
                    <h3 className="items-section-title">Itens do Pedido ({order.itens?.length || 0})</h3>
                    <div className="v5-items-list">
                        {order.itens?.map((item, idx) => (
                            <div key={idx} className="v5-item-row">
                                <div className="v5-item-main">
                                    <div className="v5-item-icon">
                                        {item.produtos?.categoria?.nome?.toLowerCase()?.includes('bebida') ? <GlassWater size={20} /> :
                                            item.produtos?.categoria?.nome?.toLowerCase()?.includes('açai') ? <IceCreamCone size={20} /> : <UtensilsCrossed size={20} />}
                                    </div>
                                    <div className="v5-item-info">
                                        <h4>{item.quantidade}x {getItemDisplayName(item)}</h4>
                                        {item.personalizacao && typeof item.personalizacao === 'object' && filterPersonalizacao(item.personalizacao, getItemDisplayName(item)).map((p, pIdx) => (
                                            <p key={pIdx} style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>
                                                <strong>{p.key}:</strong> {p.value}
                                            </p>
                                        ))}
                                        {item.observacoes && (
                                            <p className="v5-item-obs">Obs: {item.observacoes}</p>
                                        )}
                                    </div>
                                </div>
                                <span className="v5-item-price">{formatCurrency(item.preco_unitario * item.quantidade)}</span>
                            </div>
                        ))}
                    </div>

                    {order.observacoes && (
                        <div style={{ marginTop: '24px', padding: '16px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' }}>Observações Gerais</p>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#b91c1c' }}>{order.observacoes}</p>
                        </div>
                    )}

                    {order.tipo_pedido === 'entrega' && order.endereco && (
                        <div style={{ marginTop: '24px', padding: '20px', background: '#f1f5f9', borderRadius: '14px' }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Endereço de Entrega</p>
                            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: '600', color: '#475569', lineHeight: '1.4' }}>
                                {typeof order.endereco === 'string'
                                    ? order.endereco
                                    : `${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}`}
                            </p>
                            {order.endereco.referencia && (
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Ref: {order.endereco.referencia}</p>
                            )}


                        </div>
                    )}
                </div>

                {/* FOOTER SECTION */}
                <div className="modal-v5-footer">
                    <div className="v5-totals">
                        <div className="v5-total-line">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {order.taxa_entrega > 0 && (
                            <div className="v5-total-line">
                                <span>Taxa de Entrega</span>
                                <span>{formatCurrency(order.taxa_entrega)}</span>
                            </div>
                        )}
                        <div className="v5-total-final">
                            <span>Total do Pedido</span>
                            <span className="amount">{formatCurrency(order.valor_total)}</span>
                        </div>
                    </div>

                    <div className="v5-footer-actions">
                        {order.status === 'cancelado' ? (
                            <>
                                <button className="btn-v5-finish" onClick={onClose}>
                                    <ArrowRight size={20} />
                                    VOLTAR AO KANBAN
                                </button>
                                <button className="btn-v5-finish" style={{ background: '#10B981' }} onClick={() => {
                                    onReactivate(order)
                                    onClose()
                                }}>
                                    <RotateCcw size={20} />
                                    REATIVAR PEDIDO
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn-v5-cancel" onClick={() => onCancel(order)}>
                                    <XCircle size={20} />
                                    CANCELAR PEDIDO
                                </button>
                                {order.status === 'saiu_entrega' ? (
                                    <button className="btn-v5-finish" onClick={() => {
                                        onStatusChange(order.id, 'entregue');
                                        onClose();
                                    }}>
                                        <CheckCircle size={20} />
                                        FINALIZAR ENTREGA
                                    </button>
                                ) : (
                                    <button className="btn-v5-finish" onClick={onClose}>
                                        <ArrowRight size={20} />
                                        VOLTAR AO KANBAN
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {order.comanda_id && (
                        <div style={{ marginTop: '24px' }}>
                            <ComandaSummary
                                comandaId={order.comanda_id}
                                onFinalize={(cid) => onFinalizeComanda(cid)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
