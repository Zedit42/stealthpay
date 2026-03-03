import { useState } from 'react';
import type { WalletState } from '../App';
import { useStealthKeys } from '../hooks/useStealthKeys';

interface Props {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
}

export default function Dashboard({ wallet, connectWallet }: Props) {
  const { keys, hasKeys, generate, clear } = useStealthKeys();
  const [showKeys, setShowKeys] = useState(false);
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!hasKeys) {
    return (
      <div className="page">
        <div className="card">
          <h2>Dashboard</h2>
          <p>Generate stealth keys to get started.</p>
          <button onClick={generate} className="primary-btn">
            🔑 Generate Keys
          </button>
        </div>
      </div>
    );
  }

  const paymentLink = (() => {
    const meta = [keys!.spendingPubX, keys!.spendingPubY, keys!.viewingPubX, keys!.viewingPubY].join(',');
    return `${window.location.origin}/pay/${btoa(meta).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
  })();

  return (
    <div className="page">
      <div className="card">
        <h2>🥷 Your Dashboard</h2>

        {!wallet.isConnected && (
          <div className="connect-prompt">
            <p>Connect your wallet to interact with the blockchain.</p>
            <button onClick={connectWallet} className="secondary-btn">
              🔗 Connect Wallet
            </button>
          </div>
        )}

        <div className="stats">
          <div className="stat">
            <span className="stat-value">✅</span>
            <span className="stat-label">Keys Active</span>
          </div>
          <div className="stat">
            <span className="stat-value">{wallet.isConnected ? '🟢' : '🔴'}</span>
            <span className="stat-label">Wallet {wallet.isConnected ? 'Connected' : 'Not Connected'}</span>
          </div>
          <div className="stat">
            <span className="stat-value">Sepolia</span>
            <span className="stat-label">Network</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>📎 Your Payment Link</h2>
        <p className="note">Share this link to receive private payments.</p>
        <div className="link-box">
          <code>{paymentLink.length > 80 ? paymentLink.slice(0, 80) + '...' : paymentLink}</code>
          <button
            onClick={() => copyToClipboard(paymentLink, 'link')}
            className="copy-btn"
          >
            {copied === 'link' ? '✅' : '📋'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>🔐 Key Management</h2>
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="toggle-btn"
          >
            {showKeys ? '🙈 Hide' : '👁️ Show'} Keys
          </button>
        </div>

        {showKeys && (
          <div className="key-list">
            <div className="key-item">
              <label>Spending Public Key (X)</label>
              <div className="key-value">
                <code>{keys!.spendingPubX}</code>
                <button onClick={() => copyToClipboard(keys!.spendingPubX, 'spx')} className="copy-btn-sm">
                  {copied === 'spx' ? '✅' : '📋'}
                </button>
              </div>
            </div>
            <div className="key-item">
              <label>Viewing Public Key (X)</label>
              <div className="key-value">
                <code>{keys!.viewingPubX}</code>
                <button onClick={() => copyToClipboard(keys!.viewingPubX, 'vpx')} className="copy-btn-sm">
                  {copied === 'vpx' ? '✅' : '📋'}
                </button>
              </div>
            </div>
            <div className="key-item danger">
              <label>⚠️ Spending Private Key</label>
              <div className="key-value">
                <code>{keys!.spendingKey}</code>
                <button onClick={() => copyToClipboard(keys!.spendingKey, 'sk')} className="copy-btn-sm">
                  {copied === 'sk' ? '✅' : '📋'}
                </button>
              </div>
              <p className="warning">Never share this key! Anyone with this key can withdraw your funds.</p>
            </div>
          </div>
        )}

        <div className="key-actions">
          <button onClick={generate} className="secondary-btn">
            🔄 Regenerate Keys
          </button>
          <button onClick={() => { if (confirm('Delete all keys? You will lose access to any received payments.')) clear(); }} className="danger-btn">
            🗑️ Delete Keys
          </button>
        </div>
      </div>
    </div>
  );
}
