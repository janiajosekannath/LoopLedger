import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import FormField from '../components/FormField';
import Spinner from '../components/Spinner';
import { CheckCircle, XCircle } from 'lucide-react';

const rules = [
  { label: 'At least 9 characters', test: (p) => p.length >= 9 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One special character', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Password reset!</h2>
              <p className="text-sm text-gray-500 mt-2">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Set new password</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="New password" required>
                  <input type="password" className="input" value={password}
                    onChange={(e) => setPassword(e.target.value)} required />
                  <ul className="mt-2 space-y-1">
                    {rules.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                          {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </FormField>
                <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Reset password'}
                </button>
              </form>
              <p className="mt-4 text-center text-sm">
                <Link to="/login" className="text-indigo-600 hover:text-indigo-800">Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
