import { useEffect, useState } from 'react';
import { Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from './api/client';
import Catalog from './pages/Catalog';
import WidgetDetail from './pages/WidgetDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import CustomerService from './pages/CustomerService';

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user || !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function navLinkClass({ isActive }) {
  return isActive ? 'active' : undefined;
}

function initials(user) {
  const source = user.full_name || user.email || '';
  return source.slice(0, 1).toUpperCase();
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }
    api
      .cart()
      .then((cart) => setCartCount(cart.items.reduce((sum, i) => sum + i.quantity, 0)))
      .catch(() => setCartCount(0));
  }, [user]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">W</span>
            Widget Shop
          </Link>

          <nav className="main-nav">
            <NavLink to="/" end className={navLinkClass}>
              Catalog
            </NavLink>
            {user && (
              <NavLink to="/orders" className={navLinkClass}>
                My Orders
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
            {user?.role === 'customer_service' && (
              <NavLink to="/cs" className={navLinkClass}>
                Customer Service
              </NavLink>
            )}
          </nav>

          <div className="header-actions">
            {user && (
              <Link to="/cart" className="cart-link">
                Cart
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </Link>
            )}
            {!loading && !user && (
              <>
                <Link to="/login" className="btn secondary">
                  Log in
                </Link>
                <Link to="/register" className="btn">
                  Sign up
                </Link>
              </>
            )}
            {user && (
              <div className="user-chip">
                <span className="avatar">{initials(user)}</span>
                <span>{user.full_name || user.email}</span>
                <button className="logout-button" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/widgets/:id" element={<WidgetDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <Admin />
              </RequireRole>
            }
          />
          <Route
            path="/cs"
            element={
              <RequireRole roles={['customer_service']}>
                <CustomerService />
              </RequireRole>
            }
          />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>&copy; {new Date().getFullYear()} Widget Shop. For training purposes only.</span>
          <span>Payments processed by FauxPay (fictional).</span>
        </div>
      </footer>
    </div>
  );
}
