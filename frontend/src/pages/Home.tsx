import { useState } from 'react';
import type { WalletState } from '../App';
import { useStealthKeys } from '../hooks/useStealthKeys';

interface Props {
  wallet: WalletState;
}

export default function Home(_props: Props) {
  const { keys, generate, hasKeys } = useStealthKeys();
  const [paymentLink, setPaymentLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSetup = () => {
    const newKeys = generate();
    // Payment link encodes the meta-address (spending + viewing public keys)
    const metaAddr = [
      newKeys.spendingPubX, newKeys.spendingPubY,
      newKeys.viewingPubX, newKeys.viewingPubY,
    ].join(',');
    const encoded = btoa(metaAddr);
    setPaymentLink(`${window.location.origin}/pay/${encoded}`);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>🥷 Private Payments on Starknet</h1>
        <p>Receive payments without revealing your wallet address.</p>
        <p className="subtitle">
          Powered by stealth addresses & STARK proofs.
        </p>
      </div>

      <div className="card">
        <h2>Get Started</h2>
        {!hasKeys ? (
          <>
            <p>Generate your stealth keys to create a payment link. Your keys are stored locally — never sent to any server.</p>
            <button onClick={handleSetup} className="primary-btn">
              🔑 Generate Stealth Keys
            </button>
          </>
        ) : (
          <>
            <div className="key-status">
              <span className="badge success">✅ Keys Generated</span>
              <p className="mono small">
                Spending: {keys!.spendingPubX.slice(0, 10)}...
              </p>
              <p className="mono small">
                Viewing: {keys!.viewingPubX.slice(0, 10)}...
              </p>
            </div>
            {!paymentLink && (
              <button onClick={handleSetup} className="primary-btn">
                🔗 Generate Payment Link
              </button>
            )}
          </>
        )}

        {paymentLink && (
          <div className="link-box">
            <code>{paymentLink}</code>
            <button onClick={copyLink} className="copy-btn">
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div>
              <h3>Generate Keys</h3>
              <p>Create a spending key and viewing key. Share your payment link.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div>
              <h3>Receive Payments</h3>
              <p>Senders derive a unique stealth address for each payment. No two payments go to the same address.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div>
              <h3>Scan & Withdraw</h3>
              <p>Use your viewing key to find payments. Withdraw to any wallet with a signature proof.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="features">
        <div className="feature">
          <span className="icon">🔒</span>
          <h3>Private</h3>
          <p>One-time stealth addresses per payment</p>
        </div>
        <div className="feature">
          <span className="icon">⚡</span>
          <h3>Fast</h3>
          <p>Instant on Starknet L2</p>
        </div>
        <div className="feature">
          <span className="icon">🔗</span>
          <h3>Shareable</h3>
          <p>Payment links like PayPal.me</p>
        </div>
      </div>
    </div>
  );
}
