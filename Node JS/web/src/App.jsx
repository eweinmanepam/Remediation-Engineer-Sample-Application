import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
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

export default function App() {
  const { user, logout, loading } = useAuth();

  return (
    <div>
      <nav>
        <Link to="/">Catalog</Link>
        {user && <Link to="/cart">Cart</Link>}
        {user && <Link to="/orders">My Orders</Link>}
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {user?.role === 'customer_service' && <Link to="/cs">Customer Service</Link>}
        {!loading && !user && <Link to="/login">Login</Link>}
        {!loading && !user && <Link to="/register">Register</Link>}
        {user && (
          <button onClick={logout} style={{ marginLeft: '1rem' }}>
            Log out ({user.email})
          </button>
        )}
      </nav>
      <hr />
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
    </div>
  );
}
