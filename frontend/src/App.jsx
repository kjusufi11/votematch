import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './styles/global.css';
import ZipLookup from './pages/ZipLookup';
import MyReps from './pages/MyReps';
import PoliticianProfile from './pages/PoliticianProfile';
import Survey from './pages/Survey';
import Nav from './components/Nav';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/?signin=1" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<ZipLookup />} />
          <Route path="/reps" element={<MyReps />} />
          <Route path="/politician/:id" element={<PoliticianProfile />} />
          <Route path="/survey" element={<ProtectedRoute><Survey /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
