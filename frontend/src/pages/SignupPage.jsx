import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const SignupPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', company: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwFocus, setPwFocus] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.signup(form);
      const { token, user } = res.data.data;
      login(token, user);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">LoopLedger</h1>
          <p className="text-slate-400 text-sm mt-1">Create your customer account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Full name" required>
              <input type="text" className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </FormField>
            <FormField label="Email address" required>
              <input type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </FormField>
            <FormField label="Password" required>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onFocus={() => setPwFocus(true)}
                required
              />
              {(pwFocus || form.password) && (
                <ul className="mt-2 space-y-1">
                  {rules.map((rule) => {
                    const ok = rule.test(form.password);
                    return (
                      <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                        {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </FormField>
            <FormField label="Phone">
              <input type="tel" className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Company">
              <input type="text" className="input" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </FormField>

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
