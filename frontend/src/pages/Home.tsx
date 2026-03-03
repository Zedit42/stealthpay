import { useState } from 'react';
import type { WalletState } from '../App';

interface Props {
  wallet: WalletState;
}

export default function Home({ wallet }: Props) {
  const [paymentLink, setPaymentLink] = useState('');

  const generateLink = () => {
    if (!wallet.isConnected) {
      alert('Connect your wallet first');
      return;
    }
    // In production, this would register meta-address on-chain and generate link
    const link = `${window.location.origin}/pay/${wallet.address}`;
    setPaymentLink(link);
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>Private Payments on Starknet</h1>
        <p>Receive payments without revealing your wallet address.</p>
        <p className="subtitle">
          Powered by stealth addresses and STARK proofs.
        </p>
      </div>

      <div className="card">
        <h2>Create Payment Link</h2>
        <p>Generate a shareable link. Each sender gets a unique stealth address.</p>
        <button onClick={generateLink} className="primary-btn">
          Generate Payment Link
        </button>
        {paymentLink && (
          <div className="link-box">
            <code>{paymentLink}</code>
            <button
              onClick={() => navigator.clipboard.writeText(paymentLink)}
              className="copy-btn"
            >
              📋 Copy
            </button>
          </div>
        )}
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
