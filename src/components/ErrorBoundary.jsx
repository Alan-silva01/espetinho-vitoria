import { Component } from 'react'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] App crash interceptado:', error, info?.componentStack)
    }

    handleReload = () => {
        // Limpa caches do SW para evitar chunk stale
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name))
            })
        }
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '24px',
                    background: '#FAFAFA',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    textAlign: 'center',
                    color: '#333'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>
                        Ops! Algo deu errado
                    </h2>
                    <p style={{ fontSize: '14px', color: '#888', margin: '0 0 24px 0', maxWidth: '300px' }}>
                        Tente recarregar a página. Se o problema persistir, limpe o cache do navegador.
                    </p>
                    <button
                        onClick={this.handleReload}
                        style={{
                            background: '#F97316',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px 32px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(249,115,22,0.3)'
                        }}
                    >
                        🔄 Recarregar
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
