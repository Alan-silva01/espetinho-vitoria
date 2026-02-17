import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriverAuth } from '../../hooks/useDriverAuth'
import { Bike, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'
import './DriverLoginPage.css'

export default function DriverLoginPage() {
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [error, setError] = useState('')
    const { login, loading, initializing, isAuthenticated } = useDriverAuth()
    const navigate = useNavigate()

    // Redirecionar se já estiver logado
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/entregador', { replace: true })
        }
    }, [isAuthenticated, navigate])

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await login(email, senha)
            // O redirecionamento será tratado pelo useEffect acima
        } catch (err) {
            setError(err.message || 'Erro ao realizar login. Verifique suas credenciais.')
        }
    }

    if (initializing) {
        return (
            <div className="driver-login-container">
                <div className="driver-login-card animate-fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                    <div className="btn-spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #B91C1C' }} />
                </div>
            </div>
        )
    }

    return (
        <div className="driver-login-container">
            <div className="driver-login-card animate-fade-in">
                <div className="login-header">
                    <div className="icon-badge">
                        <Bike size={32} />
                    </div>
                    <h1>Painel do Entregador</h1>
                    <p>Acesse sua conta para gerenciar suas entregas</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="input-field">
                        <label>E-mail de Acesso</label>
                        <div className="input-wrapper">
                            <Mail size={20} className="field-icon" />
                            <input
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-field">
                        <label>Senha</label>
                        <div className="input-wrapper">
                            <Lock size={20} className="field-icon" />
                            <input
                                type="password"
                                placeholder="Sua senha"
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? 'Entrando...' : (
                            <>
                                <span>Entrar no Painel</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>Desenvolvido para equipe <strong>Espetinho Vitória</strong></p>
                </div>
            </div>
        </div>
    )
}
