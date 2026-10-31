import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import FormField from '../components/FormField';
import Spinner from '../components/Spinner';
import { CheckCircle } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If that email address is registered, you'll receive a password reset link shortly.
              </p>
              <Link to="/login" className="btn-primary">Back to login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Email address" required>
                  <input type="email" className="input" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                </FormField>
                <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Send reset link'}
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

export default ForgotPasswordPage;
