import { useEffect, useState } from 'react';
import { Modal, TextInput, InlineNotification } from '@carbon/react';
import { api } from '../services/api';
import './LoginModal.scss';

interface LoginModalProps {
  open: boolean;
  onLoginSuccess: (userName: string) => void;
}

export function LoginModal({ open, onLoginSuccess }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError('');
    }
  }, [open]);

  const handleLogin = async () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const user = await api.login(password);
      onLoginSuccess(user.userName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      modalHeading="Agent Governance Portal"
      modalLabel="Authentication Required"
      primaryButtonText="Login"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleLogin}
      onRequestClose={() => {}}
      shouldSubmitOnEnter
      primaryButtonDisabled={loading || !password.trim()}
      isFullWidth={false}
    >
      <div className="login-modal__content">
        <p className="login-modal__subtitle">
          Enter the demo password to access the governance and agent management portal.
        </p>

        {error && (
          <InlineNotification
            kind="error"
            title="Login Failed"
            subtitle={error}
            onClose={() => setError('')}
            className="login-modal__error"
          />
        )}

        <TextInput
          id="password-input"
          labelText="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleLogin()}
          disabled={loading}
          placeholder="Enter demo password"
        />

        <p className="login-modal__hint">Hint: Try "demo123"</p>
      </div>
    </Modal>
  );
}
