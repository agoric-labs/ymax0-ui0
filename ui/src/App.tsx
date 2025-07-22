import { useEffect, useState, useRef } from 'react';

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
import { makePortfolioSteps, MovementDesc } from './ymax-client.ts';
import { getBrand } from './utils';
import type {
  Environment,
  EndpointConfig,
  AppState,
  YieldProtocol,
} from './types';

const { fromEntries } = Object;

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
  await suggestChain(
    ENVIRONMENT_CONFIGS[getInitialEnvironment()].NETWORK_CONFIG,
  );
  const wallet = await makeAgoricWalletConnection(watcher, ENDPOINTS.RPC);
  useAppStore.setState({ wallet });
  const { pursesNotifier } = wallet;
  for await (const purses of subscribeLatest<Purse[]>(pursesNotifier)) {
    console.log('got purses', purses);
    useAppStore.setState({ purses });
  }
};

const makeOffer = (
  usdcAmount: bigint = 1_250_000n,
  bldFeeAmount: bigint = 20_000_000n,
  yProtocol: YieldProtocol = 'Aave',
) => {
  const { wallet, offerUpInstance, purses } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  const usdcBrand = getBrand(purses, 'usdc');
  if (!usdcBrand) {
    alert('Required brand (USDC) is not available in purses.');
    return;
  }

  const poc26Brand = getBrand(purses, 'poc26');
  if (!poc26Brand) {
    alert('Required brand (PoC26) is not available in purses.');
    return;
  }

  const BLDBrand = getBrand(purses, 'bld');
  if (!BLDBrand) {
    alert('Required brand (BLD) is not available in purses.');
    return;
  }

  // Use the provided USDC amount or default to 1.25 USDC
  const giveValue = usdcAmount; // USDC has 6 decimal places

  // Create position object based on selected type
  const position: Record<string, { brand: Brand<'nat'>; value: bigint }> = {};
  position[yProtocol] = {
    brand: usdcBrand as Brand<'nat'>,
    value: giveValue,
  };

  const { give, steps } = makePortfolioSteps(position, {
    evm: 'Avalanche',
    feeBrand: BLDBrand as Brand<'nat'>,
    feeBasisPoints: bldFeeAmount,
    detail:
      yProtocol === 'USDN' ? { usdnOut: (giveValue * 99n) / 100n } : undefined,
  });

  console.log('Making offer with:', {
    instance: offerUpInstance,
    give: {
      ...give,
      Access: { brand: poc26Brand, value: 1n },
    },
  });

  // Generate a unique offerId
  const offerId = Date.now();
  // Store the offerId and position type for continuing offers
  useAppStore.setState({ offerId, yProtocol });

  wallet?.makeOffer(
    {
      source: 'contract',
      instance: offerUpInstance,
      publicInvitationMaker: 'makeOpenPortfolioInvitation',
    },
    {
      give: {
        ...give,
        Access: { brand: poc26Brand, value: 1n },
      },
    },
    { flow: steps },
    (update: { status: string; data?: unknown }) => {
      console.log('Offer update:', update);

      const bigintReplacer = (_k: string, v: any) =>
        typeof v === 'bigint' ? `${v}` : v;
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
  const { wallet, offerUpInstance, offerId, purses } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  if (!offerId) {
    alert('No previous offer ID found. Please make an initial offer first.');
    return;
  }

  const usdcBrand = getBrand(purses, 'usdc');
  if (!usdcBrand) {
    alert('Required brand (USDC) is not available in purses.');
    return;
  }

  const proposal = {
    // TODO: hardcoded for testing
    want: { Cash: { brand: usdcBrand as Brand<'nat'>, value: 300n } },
  };

  console.log('Making continuing offer with:', {
    previousOffer: offerId,
    instance: offerUpInstance,
    proposal,
  });

  const amount = proposal.want.Cash;
  const { yProtocol = 'USDN' } = useAppStore.getState();

  const steps: MovementDesc[] = [
    { src: yProtocol, dest: '@noble', amount },
    { src: '@noble', dest: '@agoric', amount },
    { src: '@agoric', dest: '<Cash>', amount },
  ];
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
    proposal,
    { flow: steps },
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
  const { wallet, offerUpInstance, purses } = useAppStore.getState();

  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  const poc26Brand = getBrand(purses, 'poc26');
  if (!poc26Brand) {
    alert('Required brand (PoC26) is not available in purses.');
    return;
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
    { give: { Access: { brand: poc26Brand, value: 1n } } }, // no USDN
    {}, // No terms needed
    (update: { status: string; data?: unknown }) => {
      console.log('Empty portfolio offer update:', update);

      const bigintReplacer = (_k: string, v: any) =>
        typeof v === 'bigint' ? `${v}` : v;
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
  const [environment, setEnvironment] = useState<Environment>(
    getInitialEnvironment(),
  );
  // Ref for chat iframe
  const chatIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setup();

    // Prevent iframe scrolling from affecting parent page
    const handleIframeLoad = () => {
      if (chatIframeRef.current) {
        try {
          // Try to access iframe content if same origin allows it
          const iframeWindow = chatIframeRef.current.contentWindow;
          if (iframeWindow) {
            iframeWindow.addEventListener('scroll', e => {
              e.stopPropagation();
            });

            // Attempt to add scroll containment to iframe document if possible
            iframeWindow.document.body.style.overflow = 'auto';
            iframeWindow.document.body.style.overscrollBehavior = 'contain';
          }
        } catch (e) {
          // Cross-origin restrictions will likely prevent access
          console.log(
            'Cannot access iframe content due to cross-origin policy',
          );
        }
      }
    };

    // Prevent wheel events from propagating outside the chat sidebar
    const chatSidebar = document.querySelector('.chat-sidebar');
    const preventPropagation = (e: Event) => {
      e.stopPropagation();
    };

    if (chatSidebar) {
      chatSidebar.addEventListener('wheel', preventPropagation);
      chatSidebar.addEventListener('touchmove', preventPropagation);
    }

    // Add load event listener to iframe if available
    if (chatIframeRef.current) {
      chatIframeRef.current.addEventListener('load', handleIframeLoad);
    }

    return () => {
      // Clean up event listeners
      if (chatIframeRef.current) {
        chatIframeRef.current.removeEventListener('load', handleIframeLoad);
      }

      if (chatSidebar) {
        chatSidebar.removeEventListener('wheel', preventPropagation);
        chatSidebar.removeEventListener('touchmove', preventPropagation);
      }
    };
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
      alert(
        'Environment changed. Please refresh the page to reconnect the wallet with the new environment.',
      );
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
      <div style={{ position: 'relative' }}>
        <Logos />

        <div className="environment-selector">
          <label htmlFor="environment-select">Env: </label>
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
              RPC: {ENDPOINTS.RPC}
              <br />
              API: {ENDPOINTS.API}
            </small>
          </div>
        </div>
      </div>

      <div className="app-container">
        <div className="main-content">
          <div className="card">
            {' '}
            <Trade
              makeOffer={(usdcAmount, bldFeeAmount, yProtocol) =>
                makeOffer(usdcAmount, bldFeeAmount, yProtocol)
              }
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
          <div className="iframe-container">
            <iframe
              ref={chatIframeRef}
              src="https://chat.agoric.net/"
              title="Agoric Community Chat"
              className="chat-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms"
            ></iframe>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
