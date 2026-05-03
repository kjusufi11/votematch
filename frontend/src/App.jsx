import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/react';
import './styles/global.css';
import ZipLookup from './pages/ZipLookup';
import MyReps from './pages/MyReps';
import PoliticianProfile from './pages/PoliticianProfile';
import Survey from './pages/Survey';
import Nav from './components/Nav';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<ZipLookup />} />
          <Route path="/reps" element={<MyReps />} />
          <Route path="/politician/:id" element={<PoliticianProfile />} />
          <Route path="/survey" element={
            <ProtectedRoute><Survey /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
