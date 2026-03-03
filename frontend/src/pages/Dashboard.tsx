import type { WalletState } from '../App';

interface Props {
  wallet: WalletState;
}

export default function Dashboard({ wallet }: Props) {
  if (!wallet.isConnected) {
    return (
      <div className="page">
        <div className="card">
          <h2>Dashboard</h2>
          <p>Connect your wallet to view your stealth payment dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Your Dashboard</h2>
        <div className="stats">
          <div className="stat">
            <span className="stat-value">0</span>
            <span className="stat-label">Payments Received</span>
          </div>
          <div className="stat">
            <span className="stat-value">0</span>
            <span className="stat-label">Payments Sent</span>
          </div>
          <div className="stat">
            <span className="stat-value">—</span>
            <span className="stat-label">Total Volume</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Your Payment Link</h2>
        <code className="link-display">
          {window.location.origin}/pay/{wallet.address}
        </code>
      </div>
    </div>
  );
}
