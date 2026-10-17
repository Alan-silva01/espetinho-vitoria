import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    X, Timer, Printer, Receipt,
    Bike, ChefHat, Store, Utensils,
    XCircle, CheckCircle, ArrowRight, RotateCcw, ReceiptText, Plus,
    Pencil, Trash2, Minus, Check, Settings2
} from 'lucide-react'
import { formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'
import { renderItemProductIcon, getCleanInitial } from '../../lib/itemIcons'
import { useOrders } from '../../hooks/useOrders'
import { suppressOrderNotification } from '../../lib/soundSuppressor'
import AddItemSheet from './AddItemSheet'
import DeleteItemDialog from './DeleteItemDialog'
import EditItemSheet from './EditItemSheet'
import EditOrderDetailsSheet from './EditOrderDetailsSheet'
import pixIcon from '../../assets/icons/pix.png'
import dinheiroIcon from '../../assets/icons/dinheiro.png'
import cartaoIcon from '../../assets/icons/cartao.png'

const getItemDisplayName = (item) => {
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
}

const formatPaymentMethod = (method) => {
    if (!method) return 'Não informada'
    const map = {
        'pix': 'PIX',
        'dinheiro': 'Dinheiro',
        'cartao_credito': 'Cartão de Crédito',
        'cartao_debito': 'Cartão de Débito',
        'pagar_na_mesa': 'Pagar na Mesa'
    }
    return map[method] || method.toUpperCase()
}

const getPaymentIcon = (method) => {
    if (!method) return null
    const lower = method.toLowerCase()
    if (lower.includes('pix')) return pixIcon
    if (lower.includes('dinheiro')) return dinheiroIcon
    if (lower.includes('cartao') || lower.includes('crédito') || lower.includes('debito')) return cartaoIcon
    return null
}

export default function OrderDetailModal({
    order,
    onClose,
    onStatusChange,
    onPrint,
    onCancel,
    onReactivate,
    onFinalizeComanda,
    onOrderUpdated,
}) {
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false)
    const [showAddItem, setShowAddItem] = useState(false)
    const [showEditItem, setShowEditItem] = useState(null) // item being edited
    const [showEditDetails, setShowEditDetails] = useState(false)
    // Delete confirmation dialog
    const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
    // Local copy of the order so we can update instantly without closing modal
    const [localOrder, setLocalOrder] = useState(order)
    const [actionLoading, setActionLoading] = useState(false)

    const { addItemToOrder, editItemInOrder, removeItemFromOrder, updateOrderDetails } = useOrders()

    const handleSaveOrderDetails = useCallback(async (updatedFields) => {
        if (!localOrder) return
        setActionLoading(true)
        try {
            suppressOrderNotification(localOrder.id, 8000)
            const updated = await updateOrderDetails(localOrder.id, updatedFields, localOrder)
            if (updated) {
                setLocalOrder(updated)
                onOrderUpdated?.(updated)
            }
        } catch (err) {
            console.error('[OrderDetailModal] handleSaveOrderDetails error:', err)
            throw err
        } finally {
            setActionLoading(false)
        }
    }, [localOrder, updateOrderDetails, onOrderUpdated])

    // Sync localOrder when parent sends fresh DB data (e.g. after fetchOrders replaces temp IDs)
    // Only sync if the incoming order has meaningful differences (new items or no temp IDs)
    useEffect(() => {
        if (!order) return
        // If localOrder has temp items and fresh order doesn't → use fresh order
        const hasTempItems = localOrder?.itens?.some(i => String(i.id).startsWith('temp-'))
        const freshHasNoTempItems = !order?.itens?.some(i => String(i.id).startsWith('temp-'))
        if (hasTempItems && freshHasNoTempItems) {
            setLocalOrder(order)
            return
        }
        // Sync scalar fields (totals, status, etc.) without replacing itens
        // to avoid overwriting any in-flight optimistic changes
        if (order.valor_total !== localOrder?.valor_total || order.status !== localOrder?.status) {
            setLocalOrder(prev => ({ ...prev, ...order, itens: prev.itens }))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order])

    const handleAddItem = useCallback(async (newItem) => {
        if (!localOrder) return
        setActionLoading(true)
        try {
            suppressOrderNotification(localOrder.id, 8000)
            const updated = await addItemToOrder(localOrder.id, newItem, localOrder)
            if (updated) {
                // Use the real DB id returned from Supabase insert immediately
                const realId = updated._lastInsertedId || `temp-${Date.now()}`
                const optimisticItem = {
                    id: realId,
                    produto_id: newItem.produto_id,
                    variacao_id: newItem.variacao_id || null,
                    quantidade: newItem.quantidade,
                    preco_unitario: newItem.preco_unitario,
                    personalizacao: newItem.personalizacao || null,
                    observacoes: newItem.observacoes || null,
                    // Mirror the Supabase join shape
                    produtos: newItem._product ? {
                        nome: newItem._product.nome,
                        imagem_url: newItem._product.imagem_url,
                        categorias: newItem._product.categorias,
                        opcoes_personalizacao: newItem._product.opcoes_personalizacao,
                    } : null,
                    variacoes_produto: newItem._variation ? {
                        nome: newItem._variation.nome,
                        imagem_url: newItem._variation.imagem_url,
                    } : null,
                }
                const updatedWithItens = {
                    ...updated,
                    itens: localOrder.itens
                        ? [...localOrder.itens, optimisticItem]
                        : [optimisticItem],
                }
                setLocalOrder(updatedWithItens)
                onOrderUpdated?.(updatedWithItens)
            }
            setShowAddItem(false)
        } catch (err) {
            console.error('[OrderDetailModal] addItem error:', err)
            alert('Erro ao adicionar item. Tente novamente.')
        } finally {
            setActionLoading(false)
        }
    }, [localOrder, addItemToOrder, onOrderUpdated])

    const handleRemoveItem = useCallback(async (itemId) => {
        if (!localOrder) return
        setActionLoading(true)
        try {
            suppressOrderNotification(localOrder.id, 8000)
            const updated = await removeItemFromOrder(itemId, localOrder)
            if (updated) {
                setLocalOrder(updated)
                onOrderUpdated?.(updated)
            }
        } catch (err) {
            console.error('[OrderDetailModal] removeItem error:', err)
            alert('Erro ao remover item. Tente novamente.')
        } finally {
            setActionLoading(false)
            setDeleteTarget(null)
        }
    }, [localOrder, removeItemFromOrder, onOrderUpdated])

    const handleEditedItem = useCallback(async (itemId, updatedData) => {
        if (!localOrder) return
        // updatedData: { quantidade, preco_unitario, variacao_id, personalizacao, observacoes, _variation }
        setActionLoading(true)
        try {
            suppressOrderNotification(localOrder.id, 8000)
            const updated = await editItemInOrder(itemId, updatedData.quantidade, localOrder, updatedData)
            if (updated) {
                setLocalOrder(updated)
                onOrderUpdated?.(updated)
            }
            setShowEditItem(null)
        } catch (err) {
            console.error('[OrderDetailModal] editItem error:', err)
            alert('Erro ao editar item. Tente novamente.')
        } finally {
            setActionLoading(false)
        }
    }, [localOrder, editItemInOrder, onOrderUpdated])

    if (!localOrder) return null

    const isActiveOrder = ['confirmado', 'preparando'].includes(localOrder.status)

    return createPortal(
        <div className="modal-overlay-v4" onClick={onClose}>
            <div className="receipt-modal-wrapper" onClick={e => e.stopPropagation()}>
                <div className="receipt-card-container">
                    {/* TOPO ESCURO ESTILO RECIBO */}
                    <div className="receipt-top-bar">
                        <span className="receipt-top-title">DETALHES DO PEDIDO</span>
                        <div className="receipt-top-right">
                            <span className="receipt-top-number">N - {localOrder.numero_pedido}</span>
                            <button className="receipt-top-close-btn" onClick={onClose} title="Fechar (ESC)">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* CONTEÚDO PRINCIPAL DO RECIBO */}
                    <div className="receipt-content-scroll">
                        {/* CABEÇALHO DO CLIENTE & META (COMPACTO) */}
                        <div className="receipt-client-section">
                            <div className="receipt-client-row">
                                <div
                                    className={`receipt-client-avatar ${localOrder.clientes?.avatr_url ? 'clickable' : ''}`}
                                    onClick={() => localOrder.clientes?.avatr_url && setIsPhotoZoomed(true)}
                                    title={localOrder.clientes?.avatr_url ? 'Clique para ampliar a foto' : undefined}
                                >
                                    {localOrder.clientes?.avatr_url ? (
                                        <img
                                            src={localOrder.clientes.avatr_url}
                                            alt={localOrder.nome_cliente || 'Cliente'}
                                        />
                                    ) : (
                                        <span>{getCleanInitial(localOrder.nome_cliente)}</span>
                                    )}
                                </div>
                                <div className="receipt-client-info">
                                    <div className="receipt-client-top-row">
                                        <h3 className="receipt-client-name">{localOrder.nome_cliente || 'Cliente sem nome'}</h3>
                                        {localOrder.status === 'entregue' ? (
                                            <div className="receipt-status-concluido">
                                                <img
                                                    src="/icons/verificado-verde.png"
                                                    alt="Concluído"
                                                    className="receipt-status-verified-img"
                                                />
                                                <span>Concluído</span>
                                            </div>
                                        ) : (
                                            <div className={`receipt-status-pill ${localOrder.status}`}>
                                                {localOrder.status === 'cancelado' ? (
                                                    <X size={12} strokeWidth={2.5} />
                                                ) : (
                                                    <Timer size={12} />
                                                )}
                                                <span>
                                                    {localOrder.status === 'cancelado' ? 'Cancelado' :
                                                        localOrder.status === 'confirmado' ? 'Confirmado' :
                                                            localOrder.status === 'preparando' ? 'Em Preparo' : 'Em Entrega'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="receipt-meta-line-spaced" style={{ alignItems: 'center' }}>
                                        <span className="receipt-meta-date">{new Date(localOrder.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date(localOrder.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="receipt-meta-type-caps">
                                                {localOrder.tipo_pedido === 'mesa' && localOrder.mesas ? (
                                                    `MESA ${localOrder.mesas.numero}`
                                                ) : localOrder.tipo_pedido === 'entrega' ? (
                                                    'ENTREGA'
                                                ) : (
                                                    'RETIRADA'
                                                )}
                                            </span>
                                            {isActiveOrder && localOrder.tipo_pedido !== 'mesa' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEditDetails(true)}
                                                    style={{
                                                        border: '1px solid #d4d4d4',
                                                        background: '#ffffff',
                                                        color: '#171717',
                                                        cursor: 'pointer',
                                                        padding: '2px 6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        borderRadius: '3px',
                                                        lineHeight: 1.2
                                                    }}
                                                    title="Editar Tipo e Pagamento do Pedido"
                                                >
                                                    <Pencil size={10} />
                                                    <span>EDITAR</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {localOrder.comanda_status === 'fechamento_solicitado' && localOrder.status !== 'cancelado' && (
                                <div className="receipt-alert-closing">
                                    <Receipt size={13} />
                                    <span>Solicitou Fechamento de Conta</span>
                                </div>
                            )}
                        </div>

                        {/* BARRA DE CABEÇALHO DA TABELA DE PRODUTOS */}
                        <div className="receipt-table-header">
                            <span>PRODUTOS</span>
                            <span>PREÇO</span>
                        </div>

                        {/* LISTA COMPACTA DOS ITENS COM ÍCONE + AÇÕES */}
                        <div className="receipt-items-container">
                            {localOrder.itens?.map((item, idx) => {
                                return (
                                    <div key={item.id || idx} className="receipt-item-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
                                        <div className="receipt-item-left" style={{ flex: 1, minWidth: 0 }}>
                                            <div className="receipt-item-icon-box">
                                                {renderItemProductIcon(item, { size: 28, imgClassName: 'receipt-product-img' })}
                                            </div>
                                            <div className="receipt-item-details">
                                                <span className="receipt-item-title">
                                                    <strong>{item.quantidade}x</strong> {getItemDisplayName(item)}
                                                </span>
                                                {item.personalizacao && typeof item.personalizacao === 'object' && filterPersonalizacao(item.personalizacao, getItemDisplayName(item)).map((p, pIdx) => (
                                                    <span key={pIdx} className="receipt-item-sub">
                                                        {p.key}: {p.value}
                                                    </span>
                                                ))}
                                                {item.observacoes && (
                                                    <span className="receipt-item-obs">Obs: {item.observacoes}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            <span className="receipt-item-price">
                                                {formatCurrency(item.preco_unitario * item.quantidade)}
                                            </span>

                                            {/* Ações de edição apenas para pedidos ativos */}
                                            {isActiveOrder && (() => {
                                                const isTemp = String(item.id).startsWith('temp-')
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: isTemp ? 0.4 : 1 }}>
                                                        <button
                                                            style={itemActionBtnStyle('#f5f5f5', '#171717')}
                                                            onClick={() => setShowEditItem(item)}
                                                            disabled={actionLoading || isTemp}
                                                            title="Editar item"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button
                                                            style={itemActionBtnStyle('#fff1f1', '#dc2626')}
                                                            onClick={() => setDeleteTarget({ id: item.id, name: getItemDisplayName(item) })}
                                                            disabled={actionLoading || isTemp}
                                                            title="Remover item"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* BOTÃO ADICIONAR ITEM AO PEDIDO (Apenas para status ativos) */}
                        {isActiveOrder && (
                            <div style={{ padding: '8px 4px 4px', display: 'flex', justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    className="receipt-btn-action-outline"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        border: '1px dashed #a3a3a3',
                                        background: '#fafafa',
                                        color: '#171717',
                                        fontWeight: 600,
                                        padding: '9px 14px'
                                    }}
                                    onClick={() => setShowAddItem(true)}
                                    disabled={actionLoading}
                                >
                                    <Plus size={15} strokeWidth={2.5} />
                                    <span>Adicionar Item ao Pedido</span>
                                </button>
                            </div>
                        )}

                        {/* OBSERVAÇÕES GERAIS */}
                        {localOrder.observacoes && (
                            <div className="receipt-obs-box">
                                <span className="receipt-obs-label">OBSERVAÇÕES:</span>
                                <span className="receipt-obs-text">{localOrder.observacoes}</span>
                            </div>
                        )}

                        {/* ENDEREÇO DE ENTREGA */}
                        {localOrder.tipo_pedido === 'entrega' && localOrder.endereco && (
                            <div className="receipt-address-box">
                                <span className="receipt-address-label">ENTREGAR EM:</span>
                                <p className="receipt-address-text">
                                    {typeof localOrder.endereco === 'string'
                                        ? localOrder.endereco
                                        : `${localOrder.endereco.rua}, ${localOrder.endereco.numero} - ${localOrder.endereco.bairro}`}
                                </p>
                                {localOrder.endereco.referencia && (
                                    <p className="receipt-address-ref">Ponto de ref: {localOrder.endereco.referencia}</p>
                                )}
                            </div>
                        )}

                        {/* TOTAIS DO PEDIDO (ESTILO CUPOM FISCAL) */}
                        <div className="receipt-totals-section">
                            <div className="receipt-total-line">
                                <span>Subtotal</span>
                                <span>{formatCurrency(localOrder.subtotal)}</span>
                            </div>
                            {localOrder.taxa_entrega > 0 && (
                                <div className="receipt-total-line">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatCurrency(localOrder.taxa_entrega)}</span>
                                </div>
                            )}

                            {/* TAXA DE CARTÃO */}
                            {(() => {
                                const cardFee = Number(localOrder.taxa_cartao) || Math.max(0, Number(localOrder.valor_total || 0) - (Number(localOrder.subtotal || 0) + Number(localOrder.taxa_entrega || 0)))
                                if (cardFee > 0.01) {
                                    return (
                                        <div className="receipt-total-line">
                                            <span>Taxa de Cartão</span>
                                            <span>{formatCurrency(cardFee)}</span>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            <div className="receipt-total-final">
                                <span>TOTAL</span>
                                <span className="receipt-total-amount">{formatCurrency(localOrder.valor_total)}</span>
                            </div>

                            {/* FORMA DE PAGAMENTO */}
                            <div className="receipt-payment-row">
                                <span className="receipt-payment-label">PAGAMENTO:</span>
                                <span className="receipt-payment-value">
                                    {getPaymentIcon(localOrder.forma_pagamento) && (
                                        <img
                                            src={getPaymentIcon(localOrder.forma_pagamento)}
                                            alt=""
                                            className="receipt-payment-icon-img"
                                        />
                                    )}
                                    <span>{formatPaymentMethod(localOrder.forma_pagamento)}</span>
                                    {localOrder.forma_pagamento === 'dinheiro' && localOrder.troco_para && (
                                        <span className="receipt-payment-troco"> (Troco p/ {formatCurrency(localOrder.troco_para)})</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* AÇÕES OPERACIONAIS DO PEDIDO */}
                        <div className="receipt-actions-wrapper">
                            <div className="receipt-buttons-row">
                                <div className="receipt-buttons-left">
                                    <button className="receipt-btn-action-outline" onClick={onPrint} title="Imprimir Cupom">
                                        <Printer size={15} />
                                        <span>Imprimir</span>
                                    </button>

                                    {localOrder.status === 'confirmado' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(localOrder.id, 'preparando')
                                                onClose()
                                            }}
                                        >
                                            <ChefHat size={16} />
                                            <span>Mandar p/ Cozinha</span>
                                        </button>
                                    )}

                                    {localOrder.status === 'preparando' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(localOrder.id, localOrder.tipo_pedido === 'mesa' ? 'entregue' : 'saiu_entrega')
                                                onClose()
                                            }}
                                        >
                                            <Bike size={16} />
                                            <span>{localOrder.tipo_pedido === 'mesa' ? 'Servir Pedido' : 'Enviar Pedido'}</span>
                                        </button>
                                    )}

                                    {localOrder.status === 'saiu_entrega' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(localOrder.id, 'entregue')
                                                onClose()
                                            }}
                                        >
                                            <CheckCircle size={16} />
                                            <span>Finalizar Entrega</span>
                                        </button>
                                    )}
                                </div>

                                <div className="receipt-buttons-right">
                                    {localOrder.status !== 'cancelado' && (
                                        <button className="receipt-btn-action-outline cancel" onClick={() => onCancel(localOrder)} title="Cancelar Pedido">
                                            <XCircle size={15} />
                                            <span>Cancelar Pedido</span>
                                        </button>
                                    )}

                                    {localOrder.status === 'cancelado' && (
                                        <button className="receipt-btn-action-outline reactivate" onClick={() => { onReactivate(localOrder); onClose(); }} title="Reativar Pedido">
                                            <RotateCcw size={15} />
                                            <span>Reativar Pedido</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {localOrder.comanda_id && (
                            <div className="receipt-comanda-container">
                                <ComandaSummary
                                    comandaId={localOrder.comanda_id}
                                    onFinalize={(cid) => onFinalizeComanda(cid)}
                                />
                            </div>
                        )}
                    </div>

                    {/* SERRILHADO INFERIOR (RECIBO SAWTOOTH / ZIGZAG) */}
                    <div className="receipt-sawtooth-bottom" aria-hidden="true" />
                </div>
            </div>

            {/* LIGHTBOX DA FOTO AMPLIADA DO CLIENTE (300px) */}
            {isPhotoZoomed && localOrder.clientes?.avatr_url && (
                <div
                    className="receipt-photo-zoom-overlay"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsPhotoZoomed(false)
                    }}
                >
                    <div className="receipt-photo-zoom-card" onClick={e => e.stopPropagation()}>
                        <button
                            className="receipt-photo-zoom-close"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsPhotoZoomed(false)
                            }}
                            title="Fechar"
                        >
                            <X size={20} />
                        </button>
                        <img
                            src={localOrder.clientes.avatr_url}
                            alt={localOrder.nome_cliente || 'Cliente'}
                            className="receipt-photo-zoom-img"
                        />
                        <div className="receipt-photo-zoom-caption">
                            <span>{localOrder.nome_cliente || 'Cliente'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* SHEET PARA ADICIONAR ITEM AO PEDIDO */}
            <AddItemSheet
                isOpen={showAddItem}
                onClose={() => setShowAddItem(false)}
                order={localOrder}
                onConfirmItem={handleAddItem}
            />

            {/* SHEET PARA EDITAR ITEM EXISTENTE */}
            <EditItemSheet
                isOpen={!!showEditItem}
                item={showEditItem}
                order={localOrder}
                onClose={() => setShowEditItem(null)}
                onConfirmEdit={(updatedData) => handleEditedItem(showEditItem.id, updatedData)}
            />

            {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
            <DeleteItemDialog
                isOpen={!!deleteTarget}
                itemName={deleteTarget?.name}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => handleRemoveItem(deleteTarget.id)}
            />

            {/* SHEET DE EDIÇÃO DE TIPO, TAXA E PAGAMENTO */}
            <EditOrderDetailsSheet
                isOpen={showEditDetails}
                order={localOrder}
                onClose={() => setShowEditDetails(false)}
                onSave={handleSaveOrderDetails}
            />
        </div>,
        document.body
    )
}

// Helper style factory for tiny action buttons
function itemActionBtnStyle(bg, color) {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        borderRadius: '4px',
        border: '1px solid #e5e5e5',
        background: bg,
        color,
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
    }
}
