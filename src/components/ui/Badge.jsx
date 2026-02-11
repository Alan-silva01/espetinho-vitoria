import './Badge.css'

export default function Badge({ children, color, variant = 'filled', size = 'sm' }) {
    const style = color ? {
        backgroundColor: variant === 'filled' ? color : `${color}15`,
        color: variant === 'filled' ? 'white' : color,
        borderColor: variant === 'outline' ? color : 'transparent',
    } : {}

    return (
        <span className={`badge badge-${variant} badge-${size}`} style={style}>
            {children}
        </span>
    )
}
