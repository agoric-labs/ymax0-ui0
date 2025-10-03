import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

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
import Admin from './components/Admin.tsx';
import { makePortfolioSteps } from './ymax-client.ts';
import type {
  Environment,
  AppState,
  YieldProtocol,
  EVMChain,
  MovementDesc,
} from './types';
import { getBrand } from './utils';
import { getInitialEnvironment, configureEndpoints } from './config';

const { fromEntries } = Object;

let ENDPOINTS = configureEndpoints(getInitialEnvironment(), true);
let watcher = makeAgoricChainStorageWatcher(ENDPOINTS.API, ENDPOINTS.CHAIN_ID);

const useAppStore = create<AppState>(() => ({}) as AppState);

const setup = async () => {
  watcher.watchLatest<Array<[string, unknown]>>(
    [Kind.Data, 'published.agoricNames.instance'],
    instances => {
      console.log('got instances', instances);
      useAppStore.setState({
        instances,
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
  const currentEnvironment = getInitialEnvironment();
  try {
    await fetch(ENDPOINTS.RPC);
  } catch (error) {
    throw new Error(
      `Cannot connect to Agoric ${currentEnvironment}. Please check your connection!`,
    );
  }
  await suggestChain(ENDPOINTS.NETWORK_CONFIG);
  const wallet = await makeAgoricWalletConnection(watcher, ENDPOINTS.RPC);
  useAppStore.setState({ wallet });
  const { pursesNotifier } = wallet;
  for await (const purses of subscribeLatest<Purse[]>(pursesNotifier)) {
    console.log('got purses', purses);
    useAppStore.setState({ purses });
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

const makeOffer = (
  usdcAmount: bigint = 1_250_000n,
  bldFeeAmount: bigint = 20_000_000n,
  yProtocol: YieldProtocol = 'Aave',
  evmChain: EVMChain = 'Avalanche',
  selectedSteps?: string[],
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

  const { give, steps: allSteps } = makePortfolioSteps(position, {
    evm: evmChain,
    feeBrand: BLDBrand as Brand<'nat'>,
    feeBasisPoints: bldFeeAmount,
    detail:
      yProtocol === 'USDN' ? { usdnOut: (giveValue * 99n) / 100n } : undefined,
  });

  // Filter steps based on selection if provided
  const steps =
    selectedSteps && selectedSteps.length > 0
      ? allSteps.filter(step => {
          return selectedSteps.some(id => {
            switch (id) {
              case 'access-token':
                return true; // Always include access token
              case 'deposit-to-agoric':
                return step.src === '<Deposit>' && step.dest === '@agoric';
              case 'agoric-to-noble':
                return step.src === '@agoric' && step.dest === '@noble';
              case 'noble-to-usdn':
                return step.src === '@noble' && step.dest === 'USDNVault';
              case 'noble-to-evm':
                return step.src === '@noble' && step.dest === `@${evmChain}`;
              case `evm-to-${yProtocol.toLowerCase()}`:
                return (
                  step.src === `@${evmChain}` &&
                  step.dest === `${yProtocol}_${evmChain}`
                );
              default:
                return false;
            }
          });
        })
      : allSteps;

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
      publicInvitationMaker: 'Rebalance',
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

const withdrawFromProtocol = (
  withdrawAmount: bigint,
  fromProtocol: YieldProtocol,
  evmChain?: EVMChain,
  prevOfferId?: string,
  selectedSteps?: string[],
) => {
  const { wallet, offerUpInstance, purses } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  const offerId = prevOfferId || 'open-2025-09-19T09:25:20.918Z';

  if (!offerId) {
    alert('No previous offer ID found. Please make an initial offer first.');
    return;
  }

  const usdcBrand = getBrand(purses, 'usdc');
  if (!usdcBrand) {
    alert('Required brand (USDC) is not available in purses.');
    return;
  }

  const bldBrand = getBrand(purses, 'bld');
  if (!bldBrand) {
    alert('Required brand (BLD) is not available in purses.');
    return;
  }

  const proposal = {
    want: { Cash: { brand: usdcBrand as Brand<'nat'>, value: withdrawAmount } },
  };

  console.log('Making continuing offer to withdraw from protocol with:', {
    previousOffer: offerId,
    instance: offerUpInstance,
    proposal,
    fromProtocol,
    evmChain,
  });

  const amount = proposal.want.Cash;
  const allSteps: MovementDesc[] = [];

  // Default fee amount (2 BLD = 2,000,000 micro-BLD)
  const defaultFee = { brand: bldBrand as Brand<'nat'>, value: 15_000_000n };

  // Create withdrawal steps based on protocol
  switch (fromProtocol) {
    case 'USDN':
      allSteps.push(
        { src: 'USDNVault', dest: '@noble', amount },
        { src: '@noble', dest: '@agoric', amount },
        { src: '@agoric', dest: '<Cash>', amount },
      );
      break;
    case 'Aave':
    case 'Compound':
      const chain = evmChain || 'Avalanche';
      allSteps.push(
        {
          src: `${fromProtocol}_${chain}`,
          dest: `@${chain}`,
          amount,
          fee: defaultFee,
        },
        { src: `@${chain}`, dest: '@noble', amount, fee: defaultFee },
        { src: '@noble', dest: '@agoric', amount },
        { src: '@agoric', dest: '<Cash>', amount },
      );
      break;
    default:
      alert(`Unsupported protocol: ${fromProtocol}`);
      return;
  }

  // Filter steps based on selection if provided
  const steps =
    selectedSteps && selectedSteps.length > 0
      ? allSteps.filter(step => {
          return selectedSteps.some(id => {
            switch (id) {
              case 'usdn-to-noble':
                return step.src === 'USDNVault' && step.dest === '@noble';
              case `${fromProtocol.toLowerCase()}-to-evm`:
                return (
                  step.src === `${fromProtocol}_${evmChain || 'Avalanche'}` &&
                  step.dest === `@${evmChain || 'Avalanche'}`
                );
              case 'evm-to-noble':
                return (
                  step.src === `@${evmChain || 'Avalanche'}` &&
                  step.dest === '@noble'
                );
              case 'noble-to-agoric':
                return step.src === '@noble' && step.dest === '@agoric';
              case 'receive-cash':
                return step.src === '@agoric' && step.dest === '<Cash>';
              default:
                return false;
            }
          });
        })
      : allSteps;

  wallet?.makeOffer(
    {
      source: 'continuing',
      previousOffer: offerId,
      instance: offerUpInstance,
      invitationMakerName: 'Rebalance',
      description: `Withdraw from ${fromProtocol}${evmChain ? ` on ${evmChain}` : ''}`,
    },
    proposal,
    { flow: steps },
    (update: { status: string; data?: unknown }) => {
      console.log('Protocol withdraw offer update:', update);

      const bigintReplacer = (_k: string, v: any) =>
        typeof v === 'bigint' ? `${v}` : v;
      const offerDetails = JSON.stringify(update, bigintReplacer, 2);

      if (update.status === 'error') {
        console.error('Protocol withdraw error:', update.data);
        alert(`Protocol withdraw error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Protocol withdraw accepted:', update.data);
        alert(`Protocol withdraw accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Protocol withdraw rejected:', update.data);
        alert(`Protocol withdraw rejected: ${offerDetails}`);
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

const acceptInvitation = () => {
  const { wallet, purses } = useAppStore.getState();

  if (!wallet) {
    alert('Wallet not connected');
    return;
  }

  if (!purses || purses.length === 0) {
    alert('No purses available');
    return;
  }

  const invitationPurse = purses.find(
    (purse: Purse) => purse.brandPetname === 'Invitation',
  );

  const firstPurseBalance = invitationPurse?.currentAmount.value;
  // Get the first purse instance as specified in the template

  if (
    !firstPurseBalance ||
    typeof firstPurseBalance === 'bigint' ||
    !Array.isArray(firstPurseBalance)
  ) {
    alert('Invalid invitation purse balance format');
    return;
  }

  const offer = {
    id: Date.now(),
    invitationSpec: {
      source: 'purse',
      instance: firstPurseBalance[0].instance,
      description: 'resolver',
    },
    proposal: { give: {}, want: {} },
  };

  console.log('Accepting invitation with offer:', offer);

  wallet.makeOffer(
    offer.invitationSpec,
    offer.proposal,
    {},
    (update: { status: string; data?: unknown }) => {
      console.log('Accept invitation offer update:', update);

      const bigintReplacer = (_k: string, v: any) =>
        typeof v === 'bigint' ? `${v}` : v;
      const offerDetails = JSON.stringify(update, bigintReplacer, 2);

      if (update.status === 'error') {
        console.error('Accept invitation offer error:', update.data);
        alert(`Accept invitation offer error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Accept invitation offer accepted:', update.data);
        alert(`Accept invitation offer accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Accept invitation offer refunded:', update.data);
        alert(`Accept invitation offer refunded: ${offerDetails}`);
      }
    },
    offer.id,
  );
};

const settleTransaction = (
  txId: string,
  status: string,
  prevOfferId: string,
) => {
  const { wallet } = useAppStore.getState();

  if (!wallet) {
    alert('Wallet not connected');
    return;
  }

  const offer = {
    id: Date.now(),
    invitationSpec: {
      source: 'continuing',
      previousOffer: prevOfferId,
      invitationMakerName: 'SettleTransaction',
    },
    proposal: { give: {}, want: {} },
    offerArgs: {
      txId,
      status,
    },
  };

  console.log('Settling transaction with offer:', offer);

  wallet.makeOffer(
    offer.invitationSpec,
    offer.proposal,
    offer.offerArgs,
    (update: { status: string; data?: unknown }) => {
      console.log('Settle transaction offer update:', update);

      const bigintReplacer = (_k: string, v: any) =>
        typeof v === 'bigint' ? `${v}` : v;
      const offerDetails = JSON.stringify(update, bigintReplacer, 2);

      if (update.status === 'error') {
        console.error('Settle transaction offer error:', update.data);
        alert(`Settle transaction offer error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log('Settle transaction offer accepted:', update.data);
        alert(`Settle transaction offer accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log('Settle transaction offer refunded:', update.data);
        alert(`Settle transaction offer refunded: ${offerDetails}`);
      }
    },
    offer.id,
  );
};

const signAndBroadcastAction = (publicInvitationMaker: string) => {
  const { wallet, offerUpInstance } = useAppStore.getState();
  if (!offerUpInstance) {
    alert('No contract instance found on the chain RPC: ' + ENDPOINTS.RPC);
    throw Error('no contract instance');
  }

  if (!wallet) {
    alert('Wallet not connected. Please connect wallet on main page.');
    return;
  }

  console.log(
    `Broadcasting action ${publicInvitationMaker} with instance:`,
    offerUpInstance,
  );

  wallet.makeOffer(
    {
      source: 'contract',
      instance: offerUpInstance,
      publicInvitationMaker,
    },
    {}, // No proposal
    undefined, // No offerArgs
    (update: { status: string; data?: unknown }) => {
      console.log(`${publicInvitationMaker} offer update:`, update);
      const offerDetails = JSON.stringify(update, null, 2);

      if (update.status === 'error') {
        console.error(`${publicInvitationMaker} error:`, update.data);
        alert(`${publicInvitationMaker} error: ${offerDetails}`);
      }
      if (update.status === 'accepted') {
        console.log(`${publicInvitationMaker} accepted:`, update.data);
        alert(`${publicInvitationMaker} accepted: ${offerDetails}`);
      }
      if (update.status === 'refunded') {
        console.log(`${publicInvitationMaker} rejected:`, update.data);
        alert(`${publicInvitationMaker} rejected: ${offerDetails}`);
      }
    },
  );
};

const MainPage = () => {
  const [environment, setEnvironment] = useState<Environment>(
    getInitialEnvironment(),
  );

  const { wallet, purses, offerId } = useAppStore((state: AppState) => ({
    wallet: state.wallet,
    purses: state.purses,
    offerId: state.offerId,
  }));
  const istPurse = purses?.find((p: Purse) => p.brandPetname === 'IST');
  const itemsPurse = purses?.find((p: Purse) => p.brandPetname === 'Items');
  const usdcPurse = purses?.find((p: Purse) => p.brandPetname === 'USDC');
  const bldPurse = purses?.find((p: Purse) => p.brandPetname === 'BLD');
  const poc26Purse = purses?.find((p: Purse) => p.brandPetname === 'PoC26');

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEnvironment = e.target.value as Environment;
    setEnvironment(newEnvironment);
    localStorage.setItem('agoricEnvironment', newEnvironment);

    // Update endpoints with new environment configuration
    ENDPOINTS = configureEndpoints(newEnvironment, true);
    watcher = makeAgoricChainStorageWatcher(ENDPOINTS.API, ENDPOINTS.CHAIN_ID);

    // If wallet was connected, disconnect it (refresh required)
    if (wallet) {
      alert(
        'Environment changed. Please refresh the page to reconnect the wallet with the new environment.',
      );
    }
  };

  return (
    <>
      {/* Top header with logo and wallet status */}
      <div className="top-header">
        <Logos />
        <div className="wallet-header-inline">
          <div className="wallet-status">
            {wallet && wallet.address ? (
              <div className="wallet-connected">
                <div className="wallet-info">
                  <span className="wallet-address">{wallet.address}</span>
                </div>
                <div className="connection-status">
                  <span className="status-indicator connected"></span>
                  <span className="status-text">Connected</span>
                </div>
              </div>
            ) : (
              <button
                onClick={tryConnectWallet}
                className="connect-wallet-button"
              >
                Connect Wallet
              </button>
            )}
          </div>

          <div className="environment-selector-header">
            <select
              id="env-select"
              value={environment}
              onChange={handleEnvironmentChange}
              className="env-selector"
            >
              <option value="mainnet">Mainnet</option>
              <option value="devnet">Devnet</option>
              <option value="localhost">Localhost</option>
            </select>
          </div>
        </div>
      </div>

      <div className="app-container">
        <div className="main-content">
          <div className="card">
            <Trade
              makeOffer={(
                usdcAmount,
                bldFeeAmount,
                yProtocol,
                evmChain,
                selectedSteps,
              ) =>
                makeOffer(
                  usdcAmount,
                  bldFeeAmount,
                  yProtocol,
                  evmChain,
                  selectedSteps,
                )
              }
              withdrawUSDC={withdrawUSDC}
              withdrawFromProtocol={withdrawFromProtocol}
              openEmptyPortfolio={openEmptyPortfolio}
              acceptInvitation={acceptInvitation}
              settleTransaction={settleTransaction}
              istPurse={istPurse as Purse}
              walletConnected={!!wallet}
              offerId={offerId}
              usdcPurse={usdcPurse as Purse}
              bldPurse={bldPurse as Purse}
              poc26Purse={poc26Purse as Purse}
              walletAddress={wallet?.address}
              watcher={watcher}
            />
            {wallet && istPurse && (
              <>
                <hr />
                <Inventory
                  address={wallet.address}
                  istPurse={istPurse}
                  itemsPurse={itemsPurse as Purse}
                  usdcPurse={usdcPurse as Purse}
                  bldPurse={bldPurse as Purse}
                  poc26Purse={poc26Purse as Purse}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

function App() {
  useEffect(() => {
    setup();
  }, []);

  const { wallet, instances, purses } = useAppStore((state: AppState) => ({
    wallet: state.wallet,
    instances: state.instances,
    purses: state.purses,
  }));

  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route
        path="/admin"
        element={
          <Admin
            signAndBroadcastAction={signAndBroadcastAction}
            wallet={wallet}
            tryConnectWallet={tryConnectWallet}
            instances={instances}
            purses={purses}
            keplr={(window as any).keplr}
            chainId={ENDPOINTS.CHAIN_ID}
          />
        }
      />
    </Routes>
  );
}

export default App;
