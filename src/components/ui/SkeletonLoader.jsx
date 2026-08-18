/**
 * SkeletonLoader - Reusable skeleton loading components for admin pages
 * Each variant mirrors the real layout structure for a seamless transition
 */

// Base skeleton element with shimmer animation
function SkeletonBox({ width, height, radius, style = {} }) {
    return (
        <div
            className="skeleton-box"
            style={{ width, height, borderRadius: radius || '8px', ...style }}
        />
    )
}

function SkeletonText({ width = '100%', height = '14px', style = {} }) {
    return <SkeletonBox width={width} height={height} radius="6px" style={style} />
}

// ────────────────────────────────────────
// Dashboard Skeleton
// ────────────────────────────────────────
export function DashboardSkeleton() {
    return (
        <div className="skeleton-wrapper dashboard-skeleton-wrapper">
            {/* Header */}
            <div className="skeleton-header">
                <div className="skeleton-header-left">
                    <SkeletonText width="160px" height="28px" />
                    <SkeletonText width="220px" height="14px" style={{ marginTop: 8 }} />
                </div>
                <div className="skeleton-header-right">
                    <SkeletonBox width="260px" height="40px" radius="99px" />
                    <SkeletonBox width="40px" height="40px" radius="50%" />
                </div>
            </div>

            {/* Metrics row */}
            <div className="skeleton-metrics-grid">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton-card">
                        <div className="skeleton-card-top">
                            <SkeletonBox width="40px" height="40px" radius="12px" />
                        </div>
                        <SkeletonText width="80px" height="12px" style={{ marginTop: 16 }} />
                        <SkeletonText width="120px" height="32px" style={{ marginTop: 8 }} />
                        <SkeletonText width="90px" height="12px" style={{ marginTop: 8 }} />
                    </div>
                ))}
            </div>

            {/* Volumetric row */}
            <div className="skeleton-volumetric-grid">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton-card compact">
                        <SkeletonText width="80px" height="12px" />
                        <SkeletonText width="60px" height="28px" style={{ marginTop: 8 }} />
                        <SkeletonText width="40px" height="12px" style={{ marginTop: 6 }} />
                    </div>
                ))}
            </div>

            {/* Chart + Top Products row */}
            <div className="skeleton-bottom-row">
                <div className="skeleton-card chart-card">
                    <SkeletonText width="140px" height="18px" style={{ marginBottom: 24 }} />
                    <SkeletonBox width="100%" height="180px" radius="12px" />
                </div>
                <div className="skeleton-card list-card">
                    <SkeletonText width="140px" height="18px" style={{ marginBottom: 20 }} />
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="skeleton-list-row">
                            <SkeletonBox width="36px" height="36px" radius="10px" />
                            <div className="skeleton-list-text">
                                <SkeletonText width="120px" height="13px" />
                                <SkeletonText width="70px" height="11px" style={{ marginTop: 5 }} />
                            </div>
                            <SkeletonText width="50px" height="16px" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ────────────────────────────────────────
// Orders / Kanban Skeleton
// ────────────────────────────────────────
export function OrdersSkeleton() {
    const columns = ['Recebido', 'Preparando', 'Entrega', 'Finalizado']
    return (
        <div className="skeleton-wrapper orders-skeleton-wrapper">
            {/* Header */}
            <div className="skeleton-header">
                <SkeletonText width="160px" height="28px" />
                <div className="skeleton-header-right">
                    <SkeletonBox width="180px" height="36px" radius="8px" />
                    <SkeletonBox width="36px" height="36px" radius="8px" />
                </div>
            </div>

            {/* Kanban board */}
            <div className="skeleton-kanban">
                {columns.map((col, ci) => (
                    <div key={ci} className="skeleton-kanban-col">
                        <div className="skeleton-kanban-col-header">
                            <SkeletonBox width="16px" height="16px" radius="50%" />
                            <SkeletonText width="90px" height="14px" />
                            <SkeletonBox width="24px" height="20px" radius="6px" style={{ marginLeft: 'auto' }} />
                        </div>
                        {[...Array(ci === 0 ? 3 : ci === 1 ? 2 : 1)].map((_, i) => (
                            <div key={i} className="skeleton-kanban-card">
                                <div className="skeleton-kanban-card-top">
                                    <SkeletonText width="80px" height="11px" />
                                    <SkeletonBox width="60px" height="20px" radius="6px" />
                                </div>
                                <SkeletonText width="110px" height="13px" style={{ marginTop: 8 }} />
                                {[...Array(2)].map((_, j) => (
                                    <div key={j} className="skeleton-kanban-item">
                                        <SkeletonBox width="20px" height="20px" radius="6px" />
                                        <SkeletonText width="140px" height="12px" />
                                        <SkeletonText width="30px" height="12px" style={{ marginLeft: 'auto' }} />
                                    </div>
                                ))}
                                <div className="skeleton-kanban-footer">
                                    <SkeletonText width="70px" height="11px" />
                                    <SkeletonBox width="100px" height="28px" radius="8px" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ────────────────────────────────────────
// Inventory Skeleton
// ────────────────────────────────────────
export function InventorySkeleton() {
    return (
        <div className="skeleton-wrapper inventory-skeleton-wrapper">
            {/* Header */}
            <div className="skeleton-header">
                <div className="skeleton-header-left">
                    <SkeletonText width="200px" height="28px" />
                    <SkeletonText width="200px" height="14px" style={{ marginTop: 8 }} />
                </div>
                <div className="skeleton-header-right">
                    <SkeletonBox width="120px" height="36px" radius="8px" />
                    <SkeletonBox width="120px" height="36px" radius="8px" />
                </div>
            </div>

            {/* Stats bar */}
            <div className="skeleton-stats-row">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton-stat-card">
                        <SkeletonBox width="36px" height="36px" radius="10px" />
                        <div>
                            <SkeletonText width="60px" height="24px" />
                            <SkeletonText width="80px" height="12px" style={{ marginTop: 4 }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="skeleton-tabs">
                {[...Array(5)].map((_, i) => (
                    <SkeletonBox key={i} width={`${70 + i * 10}px`} height="32px" radius="8px" />
                ))}
            </div>

            {/* Table rows */}
            <div className="skeleton-card table-skeleton">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton-table-row">
                        <SkeletonBox width="36px" height="36px" radius="8px" />
                        <div className="skeleton-list-text" style={{ flex: 1 }}>
                            <SkeletonText width="150px" height="14px" />
                            <SkeletonText width="80px" height="11px" style={{ marginTop: 4 }} />
                        </div>
                        <SkeletonBox width="80px" height="36px" radius="8px" />
                        <SkeletonBox width="80px" height="36px" radius="8px" />
                        <SkeletonBox width="60px" height="24px" radius="12px" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ────────────────────────────────────────
// Generic List Skeleton (Customers, Drivers, Menu…)
// ────────────────────────────────────────
export function ListPageSkeleton({ rows = 6, showStats = false }) {
    return (
        <div className="skeleton-wrapper list-skeleton-wrapper">
            {/* Header */}
            <div className="skeleton-header">
                <div className="skeleton-header-left">
                    <SkeletonText width="180px" height="28px" />
                    <SkeletonText width="200px" height="14px" style={{ marginTop: 8 }} />
                </div>
                <div className="skeleton-header-right">
                    <SkeletonBox width="200px" height="40px" radius="99px" />
                    <SkeletonBox width="100px" height="40px" radius="8px" />
                </div>
            </div>

            {showStats && (
                <div className="skeleton-stats-row">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton-stat-card">
                            <SkeletonBox width="40px" height="40px" radius="12px" />
                            <div>
                                <SkeletonText width="70px" height="24px" />
                                <SkeletonText width="90px" height="12px" style={{ marginTop: 4 }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search + Filters */}
            <div className="skeleton-filters">
                <SkeletonBox width="100%" height="44px" radius="12px" style={{ maxWidth: '380px' }} />
                <SkeletonBox width="100px" height="44px" radius="12px" />
            </div>

            {/* Cards / List */}
            <div className="skeleton-list-grid">
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="skeleton-card list-item-card">
                        <SkeletonBox width="48px" height="48px" radius="50%" />
                        <div className="skeleton-list-text" style={{ flex: 1 }}>
                            <SkeletonText width="150px" height="16px" />
                            <SkeletonText width="200px" height="12px" style={{ marginTop: 6 }} />
                        </div>
                        <SkeletonBox width="70px" height="28px" radius="8px" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ────────────────────────────────────────
// Settings Skeleton
// ────────────────────────────────────────
export function SettingsSkeleton() {
    return (
        <div className="skeleton-wrapper settings-skeleton-wrapper">
            <div className="skeleton-header">
                <SkeletonText width="180px" height="28px" />
            </div>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton-card settings-section-card">
                    <SkeletonText width="130px" height="18px" style={{ marginBottom: 20 }} />
                    {[...Array(3)].map((_, j) => (
                        <div key={j} className="skeleton-settings-row">
                            <div>
                                <SkeletonText width="120px" height="14px" />
                                <SkeletonText width="200px" height="12px" style={{ marginTop: 4 }} />
                            </div>
                            <SkeletonBox width="50px" height="28px" radius="14px" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}
