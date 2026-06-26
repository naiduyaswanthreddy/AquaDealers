import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
import { adminAuthService } from '@/admin/services/adminAuthService';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import '@/admin/styles/admin.css';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAdminAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isLocked = lockedUntil && new Date() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError('');
    setIsLoading(true);

    try {
      const adminUser = await adminAuthService.login(email, password);
      login(adminUser);
      navigate('/admin/dashboard');
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        const lockTime = new Date(Date.now() + 15 * 60 * 1000);
        setLockedUntil(lockTime);
        setError(`Too many failed attempts. Account locked for 15 minutes.`);
      } else {
        setError(err.message || 'Invalid credentials');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/logo.png" alt="AquaDealers Logo" style={{ height: '64px', width: 'auto', marginBottom: 12, objectFit: 'contain' }} />
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -1,
            background: 'linear-gradient(135deg, #388BFD, #A371F7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 4
          }}>
            AquaDealers
          </div>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14, fontWeight: 500 }}>
            Admin Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="admin-card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
            Sign in to your account
          </h1>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 20,
              background: 'var(--admin-danger-bg)',
              color: 'var(--admin-danger)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="admin-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--admin-text-dim)'
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aquadealers.in"
                  className="admin-input"
                  style={{ paddingLeft: 40 }}
                  required
                  autoFocus
                  disabled={!!isLocked}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="admin-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--admin-text-dim)'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••"
                  className="admin-input"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  required
                  disabled={!!isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--admin-text-dim)', padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', padding: '12px 16px', fontSize: 14 }}
              disabled={isLoading || !!isLocked}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : isLocked ? (
                'Locked — Try again later'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--admin-text-dim)',
          }}>
            No self-registration. Contact super admin for access.
          </p>
        </div>

        <p style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--admin-text-dim)',
        }}>
          AquaDealers Internal Operations Portal — Not for dealer use
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
