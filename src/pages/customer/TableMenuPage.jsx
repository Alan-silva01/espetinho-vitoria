import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Loading from '../../components/ui/Loading'
import { getActiveComanda } from '../../hooks/useOrders'

export default function TableMenuPage() {
    const { numeroMesa } = useParams()
    const navigate = useNavigate()
    const [error, setError] = useState(null)

    useEffect(() => {
        async function validateTable() {
            const num = parseInt(numeroMesa, 10)
            if (isNaN(num)) {
                setError('Número de mesa inválido.')
                return
            }

            const { data, error: fetchErr } = await supabase
                .from('mesas')
                .select('id, numero, ativa')
                .eq('numero', num)
                .single()

            if (fetchErr || !data) {
                setError('Mesa não encontrada.')
                return
            }

            if (!data.ativa) {
                setError('Esta mesa está desativada no momento.')
                return
            }

            // Verificando se já existe uma comanda ativa para esta mesa
            const activeComandaId = await getActiveComanda(data.id)

            // Salvar dados da mesa no localStorage
            localStorage.setItem('espetinho_tipo_pedido', 'mesa')
            localStorage.setItem('espetinho_mesa_id', data.id)
            localStorage.setItem('espetinho_mesa_numero', String(data.numero))

            if (activeComandaId) {
                localStorage.setItem('espetinho_comanda_id', activeComandaId)
            } else {
                localStorage.removeItem('espetinho_comanda_id')
            }

            // Redirecionar para o cardápio
            navigate('/', { replace: true })
        }

        validateTable()
    }, [numeroMesa, navigate])

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '24px',
                textAlign: 'center',
                fontFamily: 'inherit',
                background: 'var(--bg-primary, #f5f5f5)'
            }}>
                <span style={{ fontSize: '64px', marginBottom: '16px' }}>🍽️</span>
                <h1 style={{ fontSize: '22px', color: 'var(--text-primary, #333)', marginBottom: '8px' }}>
                    Ops!
                </h1>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary, #666)', marginBottom: '24px' }}>
                    {error}
                </p>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '12px 32px',
                        background: 'var(--cor-primaria, #C41E2E)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Ir para o Cardápio
                </button>
            </div>
        )
    }

    return <Loading fullScreen text="Carregando mesa..." />
}
