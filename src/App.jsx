import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { CartProvider } from './hooks/useCart'
import Loading from './components/ui/Loading'

/* Customer Pages */
const HomePage = lazy(() => import('./pages/customer/HomePage'))
const ProductPage = lazy(() => import('./pages/customer/ProductPage'))
const CartPage = lazy(() => import('./pages/customer/CartPage'))
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage'))
const TrackingPage = lazy(() => import('./pages/customer/TrackingPage'))
const OrdersListPage = lazy(() => import('./pages/customer/OrdersListPage'))
const FavoritesPage = lazy(() => import('./pages/customer/FavoritesPage'))
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'))

/* Admin Pages */
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage'))
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage'))
const MenuPage = lazy(() => import('./pages/admin/MenuPage'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'))
const DriversPage = lazy(() => import('./pages/admin/DriversPage'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const PromosPage = lazy(() => import('./pages/admin/PromosPage'))

/* Layouts */
import CustomerLayout from './layouts/CustomerLayout'
import AdminLayout from './layouts/AdminLayout'

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Suspense fallback={<Loading fullScreen />}>
          <Routes>
            {/* ===== App Cliente (Mobile) ===== */}
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/produto/:id" element={<ProductPage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/pedido/:id" element={<TrackingPage />} />
              <Route path="/pedidos" element={<OrdersListPage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>

            {/* ===== Painel Admin ===== */}
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="pedidos" element={<OrdersPage />} />
              <Route path="estoque" element={<InventoryPage />} />
              <Route path="cardapio" element={<MenuPage />} />
              <Route path="promocoes" element={<PromosPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="motoboys" element={<DriversPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </BrowserRouter>
  )
}

export default App
