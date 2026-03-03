import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Home from './pages/Home';
import Pay from './pages/Pay';
import Scan from './pages/Scan';
import Dashboard from './pages/Dashboard';
import './App.css';

export interface WalletState {
  address: string;
  isConnected: boolean;
}

function App() {
  const [wallet, setWallet] = useState<WalletState>({
    address: '',
    isConnected: false,
  });
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      // Check if any Starknet wallet is installed
      const win = window as any;
      const starknetWallet = win.starknet_argentX || win.starknet_braavos || win.starknet;

      if (!starknetWallet) {
        alert('No Starknet wallet found!\n\nPlease install Argent X or Braavos:\n• Argent X: https://www.argent.xyz/argent-x/\n• Braavos: https://braavos.app/');
        setConnecting(false);
        return;
      }

      await starknetWallet.enable({ starknetVersion: 'v5' });
      if (starknetWallet.selectedAddress) {
        setWallet({
          address: starknetWallet.selectedAddress,
          isConnected: true,
        });
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
      alert('Wallet connection failed. Please try again.');
    }
    setConnecting(false);
  }, []);

  const disconnectWallet = () => {
    setWallet({ address: '', isConnected: false });
  };

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <Link to="/" className="logo">
            StealthPay
          </Link>
          <div className="nav-links">
            <Link to="/scan">Scan</Link>
            <Link to="/dashboard">Dashboard</Link>
            {wallet.isConnected ? (
              <div className="wallet-connected">
                <span className="wallet-addr">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
                <button onClick={disconnectWallet} className="disconnect-btn">✕</button>
              </div>
            ) : (
              <button onClick={connectWallet} className="connect-btn" disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Home wallet={wallet} connectWallet={connectWallet} />} />
            <Route path="/pay/:metaAddress" element={<Pay wallet={wallet} connectWallet={connectWallet} />} />
            <Route path="/scan" element={<Scan wallet={wallet} connectWallet={connectWallet} />} />
            <Route path="/dashboard" element={<Dashboard wallet={wallet} connectWallet={connectWallet} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
