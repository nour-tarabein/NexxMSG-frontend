import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoginLoading, loginError } = useAuth();
  const navigate = useNavigate();



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate('/chat');
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-500">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md p-6 space-y-6 bg-card border border-border rounded-xl shadow-md">
          <h2 className="text-2xl font-bold text-center">Welcome back</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="mt-1 w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="mt-1 w-full px-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {loginError && <p className="text-destructive text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={isLoginLoading}
              className="w-full py-3 bg-[coral] text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
            >
              {isLoginLoading ? 'Logging in…' : 'Log In'}
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-foreground hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
