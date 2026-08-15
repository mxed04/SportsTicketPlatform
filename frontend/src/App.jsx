import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import Payment from './pages/Payment';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/tickets/:id" 
          element={
            <PrivateRoute>
              <TicketDetail />
            </PrivateRoute>
          } 
        />
        {/* 🔴 این دقیقاً همان خطی است که ری‌اکت دنبالش می‌گشت! */}
        <Route 
          path="/payment/:reservationId" 
          element={
            <PrivateRoute>
              <Payment />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;