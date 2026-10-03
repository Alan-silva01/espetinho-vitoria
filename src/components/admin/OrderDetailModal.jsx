import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
    X, Timer, Printer, Receipt,
    Bike, ChefHat, Store, Utensils,
    XCircle, CheckCircle, ArrowRight, RotateCcw, ReceiptText
} from 'lucide-react'
import { formatCurrency, filterPersonalizacao, getSmartItemName } from '../../lib/utils'
import { renderItemProductIcon, getCleanInitial } from '../../lib/itemIcons'
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
    ComandaSummary
}) {
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false)
    if (!order) return null

    return createPortal(
        <div className="modal-overlay-v4" onClick={onClose}>
            <div className="receipt-modal-wrapper" onClick={e => e.stopPropagation()}>
                <div className="receipt-card-container">
                    {/* TOPO ESCURO ESTILO RECIBO */}
                    <div className="receipt-top-bar">
                        <span className="receipt-top-title">DETALHES DO PEDIDO</span>
                        <div className="receipt-top-right">
                            <span className="receipt-top-number">N - {order.numero_pedido}</span>
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
                                    className={`receipt-client-avatar ${order.clientes?.avatr_url ? 'clickable' : ''}`}
                                    onClick={() => order.clientes?.avatr_url && setIsPhotoZoomed(true)}
                                    title={order.clientes?.avatr_url ? 'Clique para ampliar a foto' : undefined}
                                >
                                    {order.clientes?.avatr_url ? (
                                        <img
                                            src={order.clientes.avatr_url}
                                            alt={order.nome_cliente || 'Cliente'}
                                        />
                                    ) : (
                                        <span>{getCleanInitial(order.nome_cliente)}</span>
                                    )}
                                </div>
                                <div className="receipt-client-info">
                                    <div className="receipt-client-top-row">
                                        <h3 className="receipt-client-name">{order.nome_cliente || 'Cliente sem nome'}</h3>
                                        {order.status === 'entregue' ? (
                                            <div className="receipt-status-concluido">
                                                <img
                                                    src="/icons/verificado-verde.png"
                                                    alt="Concluído"
                                                    className="receipt-status-verified-img"
                                                />
                                                <span>Concluído</span>
                                            </div>
                                        ) : (
                                            <div className={`receipt-status-pill ${order.status}`}>
                                                {order.status === 'cancelado' ? (
                                                    <X size={12} strokeWidth={2.5} />
                                                ) : (
                                                    <Timer size={12} />
                                                )}
                                                <span>
                                                    {order.status === 'cancelado' ? 'Cancelado' :
                                                        order.status === 'confirmado' ? 'Confirmado' :
                                                            order.status === 'preparando' ? 'Em Preparo' : 'Em Entrega'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="receipt-meta-line-spaced">
                                        <span className="receipt-meta-date">{new Date(order.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="receipt-meta-type-caps">
                                            {order.tipo_pedido === 'mesa' && order.mesas ? (
                                                `MESA ${order.mesas.numero}`
                                            ) : order.tipo_pedido === 'entrega' ? (
                                                'ENTREGA'
                                            ) : (
                                                'RETIRADA'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {order.comanda_status === 'fechamento_solicitado' && order.status !== 'cancelado' && (
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

                        {/* LISTA COMPACTA DOS ITENS COM ÍCONE */}
                        <div className="receipt-items-container">
                            {order.itens?.map((item, idx) => (
                                <div key={idx} className="receipt-item-row">
                                    <div className="receipt-item-left">
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
                                    <span className="receipt-item-price">
                                        {formatCurrency(item.preco_unitario * item.quantidade)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* OBSERVAÇÕES GERAIS */}
                        {order.observacoes && (
                            <div className="receipt-obs-box">
                                <span className="receipt-obs-label">OBSERVAÇÕES:</span>
                                <span className="receipt-obs-text">{order.observacoes}</span>
                            </div>
                        )}

                        {/* ENDEREÇO DE ENTREGA */}
                        {order.tipo_pedido === 'entrega' && order.endereco && (
                            <div className="receipt-address-box">
                                <span className="receipt-address-label">ENTREGAR EM:</span>
                                <p className="receipt-address-text">
                                    {typeof order.endereco === 'string'
                                        ? order.endereco
                                        : `${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}`}
                                </p>
                                {order.endereco.referencia && (
                                    <p className="receipt-address-ref">Ponto de ref: {order.endereco.referencia}</p>
                                )}
                            </div>
                        )}

                        {/* TOTAIS DO PEDIDO (ESTILO CUPOM FISCAL) */}
                        <div className="receipt-totals-section">
                            <div className="receipt-total-line">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                            </div>
                            {order.taxa_entrega > 0 && (
                                <div className="receipt-total-line">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatCurrency(order.taxa_entrega)}</span>
                                </div>
                            )}

                            {/* TAXA DE CARTÃO */}
                            {(() => {
                                const cardFee = Number(order.taxa_cartao) || Math.max(0, Number(order.valor_total || 0) - (Number(order.subtotal || 0) + Number(order.taxa_entrega || 0)))
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
                                <span className="receipt-total-amount">{formatCurrency(order.valor_total)}</span>
                            </div>

                            {/* FORMA DE PAGAMENTO */}
                            <div className="receipt-payment-row">
                                <span className="receipt-payment-label">PAGAMENTO:</span>
                                <span className="receipt-payment-value">
                                    {getPaymentIcon(order.forma_pagamento) && (
                                        <img
                                            src={getPaymentIcon(order.forma_pagamento)}
                                            alt=""
                                            className="receipt-payment-icon-img"
                                        />
                                    )}
                                    <span>{formatPaymentMethod(order.forma_pagamento)}</span>
                                    {order.forma_pagamento === 'dinheiro' && order.troco_para && (
                                        <span className="receipt-payment-troco"> (Troco p/ {formatCurrency(order.troco_para)})</span>
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

                                    {order.status === 'confirmado' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(order.id, 'preparando')
                                                onClose()
                                            }}
                                        >
                                            <ChefHat size={16} />
                                            <span>Mandar p/ Cozinha</span>
                                        </button>
                                    )}

                                    {order.status === 'preparando' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(order.id, order.tipo_pedido === 'mesa' ? 'entregue' : 'saiu_entrega')
                                                onClose()
                                            }}
                                        >
                                            <Bike size={16} />
                                            <span>{order.tipo_pedido === 'mesa' ? 'Servir Pedido' : 'Enviar Pedido'}</span>
                                        </button>
                                    )}

                                    {order.status === 'saiu_entrega' && (
                                        <button
                                            className="receipt-btn-advance"
                                            onClick={() => {
                                                onStatusChange(order.id, 'entregue')
                                                onClose()
                                            }}
                                        >
                                            <CheckCircle size={16} />
                                            <span>Finalizar Entrega</span>
                                        </button>
                                    )}
                                </div>

                                <div className="receipt-buttons-right">
                                    {order.status !== 'cancelado' && (
                                        <button className="receipt-btn-action-outline cancel" onClick={() => onCancel(order)} title="Cancelar Pedido">
                                            <XCircle size={15} />
                                            <span>Cancelar Pedido</span>
                                        </button>
                                    )}

                                    {order.status === 'cancelado' && (
                                        <button className="receipt-btn-action-outline reactivate" onClick={() => { onReactivate(order); onClose(); }} title="Reativar Pedido">
                                            <RotateCcw size={15} />
                                            <span>Reativar Pedido</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {order.comanda_id && (
                            <div className="receipt-comanda-container">
                                <ComandaSummary
                                    comandaId={order.comanda_id}
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
            {isPhotoZoomed && order.clientes?.avatr_url && (
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
                            src={order.clientes.avatr_url}
                            alt={order.nome_cliente || 'Cliente'}
                            className="receipt-photo-zoom-img"
                        />
                        <div className="receipt-photo-zoom-caption">
                            <span>{order.nome_cliente || 'Cliente'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    )
}
