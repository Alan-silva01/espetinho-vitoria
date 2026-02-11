import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import './LoginPage.css'

export default function LoginPage() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleLogin(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            await login(email, password)
            navigate('/admin')
        } catch (err) {
            setError('Email ou senha incorretos')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-card animate-fade-in">
                <div className="login-logo">
                    <div className="login-logo__icon">
                        <Flame size={28} color="white" />
                    </div>
                    <h1>Espetinho Vitória</h1>
                    <p>Painel Administrativo</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="login-field">
                        <Mail size={18} className="login-field__icon" />
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="login-field">
                        <Lock size={18} className="login-field__icon" />
                        <input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />
                        <button type="button" className="login-field__toggle" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <span className="btn-spinner" /> : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    )
}
