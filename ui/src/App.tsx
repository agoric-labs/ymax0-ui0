import { useEffect, useState } from 'react';

import './App.css';
import {
  makeAgoricChainStorageWatcher,
  AgoricChainStoragePathKind as Kind,
} from '@agoric/rpc';
import { create } from 'zustand';
import {
  makeAgoricWalletConnection,
  suggestChain,
} from '@agoric/web-components';
import { subscribeLatest } from '@agoric/notifier';
import { Logos } from './components/Logos';
import { Inventory } from './components/Inventory';
import { Trade } from './components/Trade';

const { fromEntries } = Object;

type Wallet = Awaited<ReturnType<typeof makeAgoricWalletConnection>>;

type Environment = 'devnet' | 'localhost';

interface EndpointConfig {
  RPC: string;
  API: string;
  NETWORK_CONFIG: string;
}

const ENVIRONMENT_CONFIGS: Record<Environment, EndpointConfig> = {
  devnet: {
    RPC: 'https://devnet.rpc.agoric.net',
    API: 'https://devnet.api.agoric.net',
    NETWORK_CONFIG: 'https://devnet.agoric.net/network-config',
  },
  localhost: {
    RPC: 'http://localhost:26657',
    API: 'http://localhost:1317',
    NETWORK_CONFIG: 'https://local.agoric.net/network-config',
  },
};

const getInitialEnvironment = (): Environment => {
  const savedEnvironment = localStorage.getItem('agoricEnvironment');
  return (savedEnvironment as Environment) || 'devnet';
};

const ENDPOINTS = { ...ENVIRONMENT_CONFIGS[getInitialEnvironment()] };
// Network config will be used from the environment configs

const codeSpaceHostName = import.meta.env.VITE_HOSTNAME;

const codeSpaceDomain = import.meta.env
  .VITE_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

// Only override with codespace endpoints if explicitly configured
if (codeSpaceHostName && codeSpaceDomain) {
  ENDPOINTS.API = `https://${codeSpaceHostName}-1317.${codeSpaceDomain}`;
  ENDPOINTS.RPC = `https://${codeSpaceHostName}-26657.${codeSpaceDomain}`;
  console.log('Using codespace endpoints:', ENDPOINTS);
} else {
  console.log(`Using ${getInitialEnvironment()} endpoints:`, ENDPOINTS);
}
const watcher = makeAgoricChainStorageWatcher(ENDPOINTS.API, 'agoricdev-25');

interface AppState {
  wallet?: Wallet;
  offerUpInstance?: unknown;
  brands?: Record<string, unknown>;
  purses?: Array<Purse>;
  offerId?: number;
}

const useAppStore = create<AppState>(() => ({}));

const setup = async () => {
  watcher.watchLatest<Array<[string, unknown]>>(
    [Kind.Data, 'published.agoricNames.instance'],
    instances => {
      console.log('got instances', instances);
      useAppStore.setState({
        offerUpInstance: instances.find(([name]) => name === 'ymax0')!.at(1),
      });
    },
  );

  watcher.watchLatest<Array<[string, unknown]>>(
    [Kind.Data, 'published.agoricNames.brand'],
    brands => {
      console.log('Got brands', brands);
      useAppStore.setState({
        brands: fromEntries(brands),
      });
    },
  );
};

const connectWallet = async () => {
  try {
    await fetch(ENDPOINTS.RPC);
  } catch (error) {
    throw new Error(
      `Cannot connect to Agoric ${getInitialEnvironment()}. Please check your connection!`,
    );
  }
  await suggestChain(ENVIRONMENT_CONFIGS[getInitialEnvironment()].NETWORK_CONFIG);
  const wallet = await makeAgoricWalletConnection(watcher, ENDPOINTS.RPC);
  useAppStore.setState({ wallet });
  const { pursesNotifier } = wallet;
  for await (const purses of subscribeLatest<Purse[]>(pursesNotifier)) {
    console.log('got purses', purses);
    useAppStore.setState({ purses });
  }
};

const makeOffer = () => {
  const { wallet, offerUpInstance, brands } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }
  if (!(brands && brands.USDC)) {
    alert('USDC brand not available');
    throw Error('USDC brand not available');
  }

  // Fixed amount of 1.10 USDC
  const giveValue = 1_100_000n; // Assuming 6 decimal places for USDC
  const give = { USDN: { brand: brands.USDC, value: giveValue } };

  console.log('Making offer with:', {
    instance: offerUpInstance,
    give,
  });

  // Generate a unique offerId
  const offerId = Date.now();
  // Store the offerId for continuing offers
  useAppStore.setState({ offerId });

  wallet?.makeOffer(
    {
      source: 'contract',
      instance: offerUpInstance,
      publicInvitationMaker: 'makeOpenPortfolioInvitation',
    },
    { give },
    { usdnOut: giveValue * 99n / 100n }, // XXX should query
    (update: { status: string; data?: unknown }) => {
      console.log('Offer update:', update);

      const bigintReplacer = (_k: string, v: any) => typeof v === 'bigint' ? `${v}`: v;
      const offerDetails = JSON.stringify(update, bigintReplacer, 2);

      if (update.status === 'error') {
        console.error('Offer error:', update.data);
        alert(`Offer error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Offer accepted:', update.data);
        alert(`Offer accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Offer rejected:', update.data);
        alert(`Offer rejected: ${offerDetails}`);
      }
    },
    offerId, // Pass the offerId for future reference
  );
};

const withdrawUSDC = () => {
  const { wallet, offerUpInstance, offerId } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  if (!offerId) {
    alert('No previous offer ID found. Please make an initial offer first.');
    return;
  }

  console.log('Making continuing offer with:', {
    previousOffer: offerId,
    instance: offerUpInstance,
  });

  wallet?.makeOffer(
    {
      source: 'continuing',
      previousOffer: offerId,
      instance: offerUpInstance,
      invitationMakerName: 'makeWithdrawInvitation',
      publicInvitationMaker: 'makeWithdrawInvitation',
      description: 'Withdraw USDC',
      fee: {
        gas: 400000,
      },
    },
    {}, // No assets being exchanged in this follow-up offer
    { amountValue: 300n }, // TODO: hardcoded for testing
    (update: { status: string; data?: unknown }) => {
      console.log('Withdraw offer update:', update);

      const offerDetails = JSON.stringify(update, null, 2);

      if (update.status === 'error') {
        console.error('Withdraw error:', update.data);
        alert(`Withdraw error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Withdraw accepted:', update.data);
        alert(`Withdraw accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Withdraw rejected:', update.data);
        alert(`Withdraw rejected: ${offerDetails}`);
      }
    },
  );
};

const openEmptyPortfolio = () => {
  const { wallet, offerUpInstance } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  // Generate a unique offerId
  const offerId = Date.now();
  // Store the offerId for continuing offers
  useAppStore.setState({ offerId });

  console.log('Opening empty portfolio with:', {
    instance: offerUpInstance,
  });

  wallet?.makeOffer(
    {
      source: 'contract',
      instance: offerUpInstance,
      publicInvitationMaker: 'makeOpenPortfolioInvitation',
    },
    {}, // Empty give - no USDC being provided
    {}, // No terms needed
    (update: { status: string; data?: unknown }) => {
      console.log('Empty portfolio offer update:', update);

      const bigintReplacer = (_k: string, v: any) => typeof v === 'bigint' ? `${v}`: v;
      const offerDetails = JSON.stringify(update, bigintReplacer, 2);

      if (update.status === 'error') {
        console.error('Empty portfolio offer error:', update.data);
        alert(`Empty portfolio offer error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Empty portfolio offer accepted:', update.data);
        alert(`Empty portfolio offer accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Empty portfolio offer rejected:', update.data);
        alert(`Empty portfolio offer rejected: ${offerDetails}`);
      }
    },
    offerId, // Pass the offerId for future reference
  );
};

function App() {
  const [environment, setEnvironment] = useState<Environment>(getInitialEnvironment());
  
  useEffect(() => {
    setup();
  }, []);

  const { wallet, purses, offerId } = useAppStore(
    ({ wallet, purses, offerId }) => ({
      wallet,
      purses,
      offerId,
    }),
  );
  const istPurse = purses?.find(p => p.brandPetname === 'IST');
  const itemsPurse = purses?.find(p => p.brandPetname === 'Items');
  const usdcPurse = purses?.find(p => p.brandPetname === 'USDC');

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEnvironment = e.target.value as Environment;
    setEnvironment(newEnvironment);
    localStorage.setItem('agoricEnvironment', newEnvironment);
    
    // Update endpoints with new environment configuration
    Object.assign(ENDPOINTS, ENVIRONMENT_CONFIGS[newEnvironment]);
    
    // If wallet was connected, disconnect it (refresh required)
    if (wallet) {
      alert('Environment changed. Please refresh the page to reconnect the wallet with the new environment.');
    }
  };

  const tryConnectWallet = () => {
    connectWallet().catch(err => {
      switch (err.message) {
        case 'KEPLR_CONNECTION_ERROR_NO_SMART_WALLET':
          alert('no smart wallet at that address');
          break;
        default:
          alert(err.message);
      }
    });
  };

  return (
    <>
      <Logos />
      <h1>Items Listed on Offer Up</h1>

      <div className="environment-selector">
        <label htmlFor="environment-select">Environment: </label>
        <select 
          id="environment-select" 
          value={environment} 
          onChange={handleEnvironmentChange}
        >
          <option value="devnet">Devnet</option>
          <option value="localhost">Localhost</option>
        </select>
        <div className="environment-info">
          <small>
            RPC: {ENDPOINTS.RPC}<br />
            API: {ENDPOINTS.API}
          </small>
        </div>
      </div>

      <div className="app-container">
        <div className="main-content">
          <div className="card">          <Trade
            makeOffer={makeOffer}
            withdrawUSDC={withdrawUSDC}
            openEmptyPortfolio={openEmptyPortfolio}
            istPurse={istPurse as Purse}
            walletConnected={!!wallet}
            offerId={offerId}
            usdcPurse={usdcPurse as Purse}
          />
            <hr />
            {wallet && istPurse ? (
              <Inventory
                address={wallet.address}
                istPurse={istPurse}
                itemsPurse={itemsPurse as Purse}
                usdcPurse={usdcPurse as Purse}
              />
            ) : (
              <button onClick={tryConnectWallet}>Connect Wallet</button>
            )}
          </div>
        </div>
        
        <div className="chat-sidebar">
          <h3>Agoric Community Chat</h3>
          <iframe 
            src="https://chat.agoric.net/" 
            title="Agoric Community Chat"
            className="chat-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms"
          ></iframe>
        </div>
      </div>
    </>
  );
}

export default App;
