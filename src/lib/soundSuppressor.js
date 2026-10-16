/**
 * Utility to suppress audio notification and auto-print when an admin
 * manually adds an item to an order via the dashboard.
 */
const suppressedOrders = new Set()

export function suppressOrderNotification(orderId, durationMs = 5000) {
    if (!orderId) return
    suppressedOrders.add(orderId)
    setTimeout(() => {
        suppressedOrders.delete(orderId)
    }, durationMs)
}

export function isOrderNotificationSuppressed(orderId) {
    if (!orderId) return false
    return suppressedOrders.has(orderId)
}
