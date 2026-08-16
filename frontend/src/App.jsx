import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import Payment from './pages/Payment';
import Profile from './pages/Profile';
import Support from './pages/Support';
import AdminDashboard from './pages/AdminDashboard';

/**
 * Safely decodes the JWT token payload to extract the user role.
 * Falls back to localStorage 'role' if present, or defaults to 'audience'.
 */
const getUserRoleFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return localStorage.getItem('role') || 'audience';

    // Replace URL-safe characters and decode Base64 payload
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded.role || localStorage.getItem('role') || 'audience';
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return localStorage.getItem('role') || 'audience';
  }
};

/**
 * PrivateRoute component to restrict access to authenticated users only.
 */
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

/**
 * AdminRoute component to strictly limit access to users with 'admin' or 'support' role.
 */
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = getUserRoleFromToken();

  if (!token) {
    return <Navigate to="/" />;
  }

  // Deny access if user role is neither 'admin' nor 'support'
  if (role !== 'admin' && role !== 'support') {
    setTimeout(() => {
      toast.error('⛔ شما دسترسی به بخش مدیریت ندارید!');
    }, 100);
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/tickets/:id" element={<PrivateRoute><TicketDetail /></PrivateRoute>} />
        <Route path="/payment/:reservationId" element={<PrivateRoute><Payment /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/support" element={<PrivateRoute><Support /></PrivateRoute>} />
        
        {/* Secure Admin Route */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      </Routes>
    </Router>
  );
}

export default App;