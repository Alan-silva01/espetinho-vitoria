import { formatCurrency } from '../../lib/utils'
import logoImg from '../../../logo.png'

const getItemDisplayName = (item) => {
    const { getSmartItemName } = require('../../lib/utils')
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
}

export default function ThermalReceipt({ order }) {
    if (!order) return null

    return (
        <div id="thermal-receipt">
            <div className="receipt-print-container">
                <div className="receipt-logo-container">
                    <img src={logoImg} alt="VITORIA" className="receipt-logo" />
                </div>

                <div className="receipt-header-info">
                    <h2 style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', margin: '8px 0', textTransform: 'uppercase', borderBottom: '2px dashed #000', paddingBottom: '8px' }}>
                        {order.tipo_pedido === 'entrega'
                            ? '🚀 ENTREGA'
                            : order.tipo_pedido === 'mesa'
                                ? (order.nome_cliente?.toUpperCase().includes('MESA') ? order.nome_cliente?.toUpperCase() : `🍽️ MESA - ${order.nome_cliente?.toUpperCase()}`)
                                : '🛍️ RETIRADA'}
                    </h2>
                    <div className="receipt-order-num">PEDIDO #{order.numero_pedido}</div>
                    <div className="receipt-date">
                        {new Date(order.criado_em).toLocaleDateString('pt-BR')} - {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">ESTABELECIMENTO</div>
                    <div style={{ textAlign: 'center' }}>ESPETINHO VITÓRIA - ESPETOS, AÇAÍ E CALDOS</div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">CLIENTE</div>
                    <div className="receipt-data-row">
                        <span className="receipt-label">NOME:</span>
                        <span>{order.nome_cliente?.toUpperCase() || 'N/A'}</span>
                    </div>
                    <div className="receipt-data-row">
                        <span className="receipt-label">TEL:</span>
                        <span>{order.telefone_cliente || order.clientes?.telefone || 'N/A'}</span>
                    </div>
                </div>

                {order.tipo_pedido === 'entrega' && order.endereco && (
                    <>
                        <div className="receipt-divider"></div>
                        <div className="receipt-section">
                            <div className="receipt-section-title">ENDEREÇO DE ENTREGA</div>
                            <div>
                                {typeof order.endereco === 'string'
                                    ? order.endereco.toUpperCase()
                                    : `${order.endereco.rua?.toUpperCase()}, ${order.endereco.numero}`}
                            </div>
                            <div>{order.endereco.bairro?.toUpperCase()}</div>
                            {order.endereco.referencia && <div>REF: {order.endereco.referencia.toUpperCase()}</div>}
                        </div>
                    </>
                )}

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">ITENS DO PEDIDO</div>
                    <table className="receipt-table">
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>QTD</th>
                                <th style={{ width: '53%', paddingLeft: '1mm' }}>ITENS</th>
                                <th style={{ width: '32%', textAlign: 'right' }}>PREÇO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.itens?.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.quantidade}</td>
                                    <td>
                                        <div>{getItemDisplayName(item)?.toUpperCase()}</div>
                                        {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                            const isAcai = getItemDisplayName(item)?.toLowerCase().includes('açaí') || getItemDisplayName(item)?.toLowerCase().includes('acai')
                                            const elements = []
                                            
                                            for (const [key, val] of Object.entries(item.personalizacao)) {
                                                if (!val || (Array.isArray(val) && val.length === 0)) continue
                                                
                                                const keyLower = key.toLowerCase()
                                                const isPaid = keyLower.includes('pago') || keyLower === 'adicionais'
                                                const isFruitSelection = keyLower.includes('escolha') || keyLower.includes('incl')
                                                
                                                if (isPaid) {
                                                    elements.push(
                                                        <div key={`title-${key}`} className="receipt-item-details" style={{ textTransform: 'uppercase', marginTop: '1mm' }}>
                                                            * Adicionais pagos:
                                                        </div>
                                                    )
                                                    
                                                    const itemsArray = Array.isArray(val) ? val : [val]
                                                    const counts = {}
                                                    itemsArray.forEach(v => {
                                                        const cleanName = String(v).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim().toUpperCase()
                                                        counts[cleanName] = (counts[cleanName] || 0) + 1
                                                    })

                                                    Object.entries(counts).forEach(([cleanName, count], idx) => {
                                                        elements.push(
                                                            <div key={`item-${key}-${idx}`} className="receipt-item-details" style={{ paddingLeft: '2mm' }}>
                                                                + {count} X {cleanName}
                                                            </div>
                                                        )
                                                    })
                                                } else if (isFruitSelection) {
                                                    let displayVal
                                                    if (Array.isArray(val)) {
                                                        const counts = {}
                                                        val.forEach(v => {
                                                            const cleanName = String(v).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim()
                                                            counts[cleanName] = (counts[cleanName] || 0) + 1
                                                        })
                                                        displayVal = Object.entries(counts)
                                                            .map(([name, count]) => count > 1 ? `${count}x ${name}` : name)
                                                            .join(', ')
                                                    } else {
                                                        displayVal = String(val)
                                                    }
                                                    elements.push(
                                                        <div key={`fruit-${key}`} className="receipt-item-details">
                                                            Frutas Escolhidas: {displayVal}
                                                        </div>
                                                    )
                                                } else if (!isAcai) {
                                                    const displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                                                    elements.push(
                                                        <div key={`other-${key}`} className="receipt-item-details">
                                                            {key}: {displayVal}
                                                        </div>
                                                    )
                                                }
                                            }

                                            return elements
                                        })()}
                                        {item.observacoes && (
                                            <div className="receipt-item-details" style={{ fontWeight: 'bold' }}>
                                                * OBS: {item.observacoes.toUpperCase()}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.preco_unitario * item.quantidade)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-total-section">
                    <div className="receipt-total-row">
                        <span>ITENS DO PEDIDO</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.taxa_entrega > 0 && (
                        <div className="receipt-total-row">
                            <span>TAXA DE ENTREGA</span>
                            <span>{formatCurrency(order.taxa_entrega)}</span>
                        </div>
                    )}
                    <div className="receipt-total-big">
                        <span>TOTAL</span>
                        <span>{formatCurrency(order.valor_total)}</span>
                    </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">FORMA DE PAGAMENTO</div>
                    <div className="receipt-data-row">
                        <span>{order.forma_pagamento?.toUpperCase()}</span>
                        <span>{formatCurrency(order.valor_total)}</span>
                    </div>
                    {order.troco_para && (
                        <div className="receipt-data-row" style={{ marginTop: '2mm' }}>
                            <span className="receipt-label">TROCO PARA:</span>
                            <span>{formatCurrency(order.troco_para)}</span>
                        </div>
                    )}
                </div>

                {order.observacoes && (
                    <>
                        <div className="receipt-divider"></div>
                        <div className="receipt-section">
                            <div className="receipt-section-title">OBSERVAÇÃO GERAL</div>
                            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{order.observacoes.toUpperCase()}</div>
                        </div>
                    </>
                )}

                <div className="receipt-footer-msg">
                    <div className="footer">
                        OBRIGADO PELA PREFERÊNCIA!<br />
                        ESPETINHO VITÓRIA
                    </div>
                </div>
            </div>
        </div>
    )
}
