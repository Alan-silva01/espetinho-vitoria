import './Loading.css'

export default function Loading({ fullScreen = false, text = '', children }) {
    if (fullScreen) {
        return (
            <div className="loading-fullscreen">
                <img src="/logo.png" alt="Logo" className="loading-logo animate-pulse" />
                <div className="loading-spinner" />
                {text && <p className="loading-text">{text}</p>}
                {children}
            </div>
        )
    }

    return <div className="loading-spinner" />
}

export function Skeleton({ width, height, borderRadius }) {
    return (
        <div
            className="skeleton"
            style={{ width, height, borderRadius }}
        />
    )
}
