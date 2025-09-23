import React, { useEffect, useState, useRef } from 'react';
import { getInitialEnvironment, configureEndpoints } from '../config';
import { makeVstorageKit, makeVStorage } from '@agoric/client-utils';
import { makeAgoricChainStorageWatcher, AgoricChainStoragePathKind as Kind } from '@agoric/rpc';
import type { Environment } from '../types';
import WalletEntriesCard from './WalletEntriesCard';
import ContractControlCard from './ContractControlCard';
import CreatorFacetCard from './CreatorFacetCard';
import TransactionHistory from './TransactionHistory';
import { formatActionColumn, extractSaveResultName } from './Admin.utils.tsx';
import { ContractService } from '../services/contractService';
import { redeemInvitation } from '../services/walletService';

type AdminProps = {
  signAndBroadcastAction: (invitationMaker: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any;
  tryConnectWallet: () => void;
  instances?: Array<[string, unknown]>;
  purses?: Array<Purse>;
  keplr?: any;
  chainId?: string;
};

// Separate data fetching logic from wallet operations
const useWalletData = (wallet: any, purses: Array<Purse> | undefined, watcher: any, watchAddress?: string) => {
  const [invitations, setInvitations] = useState<Array<[string, number]>>([]);
  const [savedEntries, setSavedEntries] = useState<Set<string>>(new Set());
  const [pendingEntries, setPendingEntries] = useState<Set<string>>(new Set());
  const [walletUpdates, setWalletUpdates] = useState<any[]>([]);

  useEffect(() => {
    const effectiveAddress = wallet?.address || watchAddress;
    if (!effectiveAddress || !watcher) return;

    // Get invitations from purses
    const invitationPurse = purses?.find((p: any) => p.brandPetname === 'Invitation');
    if (invitationPurse?.currentAmount?.value && Array.isArray(invitationPurse.currentAmount.value)) {
      const invitationList = invitationPurse.currentAmount.value.map((invitation: any, index: number) => {
        const desc = invitation.description || 'unknown';
        return [desc, index] as [string, number];
      });
      setInvitations(invitationList);
    }

    // Watch wallet's current state
    const walletPath = `published.wallet.${effectiveAddress}.current`;
    watcher.watchLatest<any>(
      [Kind.Data, walletPath],
      (walletRecord: any) => {
        if (walletRecord?.liveOffers) {
          const currentPending = new Set<string>();
          walletRecord.liveOffers.forEach(([offerId, offerSpec]: [string, any]) => {
            if (offerSpec?.saveResult?.name) {
              currentPending.add(offerSpec.saveResult.name);
            }
          });
          setPendingEntries(currentPending);
        }

        if (walletRecord) {
          const currentSaved = new Set<string>();
          const walletInternalKeys = new Set([
            'liveOffers', 
            'offerToPublicSubscriberPaths', 
            'offerToUsedInvitation',
            'purses',
            'offerToInvitationSpec'
          ]);
          
          Object.keys(walletRecord).forEach(key => {
            if (!walletInternalKeys.has(key) && 
                typeof walletRecord[key] === 'object' && 
                walletRecord[key] !== null) {
              currentSaved.add(key);
            }
          });
          setSavedEntries(currentSaved);
        }
      }
    );

    // Watch for wallet updates
    const walletUpdatesPath = `published.wallet.${effectiveAddress}`;
    watcher.watchLatest<any>(
      [Kind.Data, walletUpdatesPath],
      (walletData: any) => {
        if (walletData && typeof walletData === 'object' && walletData.updated === 'invocation' && walletData.id && (walletData.result !== undefined || walletData.error)) {
          setWalletUpdates(prev => [...prev, walletData]);
        }
      }
    );
    
  }, [wallet, purses, watcher, watchAddress]);

  return { invitations, savedEntries, pendingEntries, walletUpdates, setSavedEntries };
};

// Separate transaction fetching logic
const useTransactionData = (walletAddress: string | undefined, endpoints: any, transactionLimit: number) => {
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchTransactions = async () => {
    if (!walletAddress) return;
    
    const url = `${endpoints.API}/cosmos/tx/v1beta1/txs?query=message.sender='${walletAddress}'&order_by=ORDER_BY_DESC&limit=${transactionLimit}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTransactions(data.tx_responses || []);
    } catch (error) {
      console.error('Could not fetch transactions:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [walletAddress, endpoints, transactionLimit]);

  return { transactions, setTransactions, fetchTransactions };
};

// Separate invocation tracking logic
const useInvocationTracking = () => {
  const [pendingInvocations, setPendingInvocations] = useState<Set<number>>(new Set());

  const trackInvocation = (tools: any, method: string, targetName: string, wallet: any, setTransactions: any) => {
    const invocationId = Date.now();
    tools.setId(invocationId);
    setPendingInvocations(prev => new Set([...prev, invocationId]));
    
    // Create a mock transaction entry for immediate display
    const mockTransaction = {
      height: 'pending',
      txhash: `pending-${invocationId}`,
      timestamp: new Date().toISOString(),
      tx: {
        body: {
          messages: [{
            '@type': '/agoric.swingset.MsgWalletSpendAction',
            owner: wallet?.address,
            spend_action: JSON.stringify({
              body: `#${JSON.stringify({
                method: 'invokeEntry',
                message: {
                  id: invocationId,
                  method,
                  targetName,
                  args: [],
                }
              })}`,
              slots: []
            })
          }]
        }
      }
    };
    
    setTransactions((prev: any[]) => [mockTransaction, ...prev]);
    return invocationId;
  };

  const handleInvocationCompletion = (walletData: any, fetchTransactions: () => void) => {
    if (walletData && typeof walletData === 'object' && walletData.updated === 'invocation' && walletData.id && (walletData.result !== undefined || walletData.error)) {
      setPendingInvocations(prev => {
        const newSet = new Set(prev);
        newSet.delete(walletData.id);
        return newSet;
      });
      fetchTransactions();
    }
  };

  return { pendingInvocations, trackInvocation, handleInvocationCompletion };
};

const Admin: React.FC<AdminProps> = ({
  signAndBroadcastAction,
  wallet,
  tryConnectWallet,
  instances,
  purses,
  keplr,
  chainId,
}) => {
  // Environment and network state
  const [environment, setEnvironment] = useState<Environment>(getInitialEnvironment());
  const [ENDPOINTS, setENDPOINTS] = useState(configureEndpoints(getInitialEnvironment()));
  const watcherRef = useRef<ReturnType<typeof makeAgoricChainStorageWatcher> | null>(null);
  const [vstorageClient, setVstorageClient] = useState<any>(null);
  
  // Instance state
  const [instanceInfo, setInstanceInfo] = useState<{
    ymax0?: string;
    postalService?: string;
  } | null>(null);
  const [instanceBlockHeight, setInstanceBlockHeight] = useState<string | null>(null);
  
  // Form state
  const [terminateMessage, setTerminateMessage] = useState<string>('');
  const [upgradeBundleId, setUpgradeBundleId] = useState<string>('');
  const [installBundleId, setInstallBundleId] = useState<string>('');
  const [creatorFacetName, setCreatorFacetName] = useState<string>('creatorFacet');
  const [plannerAddress, setPlannerAddress] = useState<string>('');
  const [transactionLimit, setTransactionLimit] = useState<number>(10);

  // Watch-only mode state
  const [watchAddress, setWatchAddress] = useState<string>('');

  // Use custom hooks for data management
  const effectiveAddress = wallet?.address || watchAddress;
  const { transactions, setTransactions, fetchTransactions } = useTransactionData(effectiveAddress, ENDPOINTS, transactionLimit);
  const { pendingInvocations, trackInvocation, handleInvocationCompletion } = useInvocationTracking();
  const { invitations, savedEntries, pendingEntries, walletUpdates, setSavedEntries } = useWalletData(wallet, purses, watcherRef.current, watchAddress);

  // Initialize contract service
  const contractService = new ContractService({
    wallet,
    keplr,
    chainId: chainId || '',
    marshaller: watcherRef.current?.marshaller,
    rpcEndpoint: ENDPOINTS.RPC,
    instances,
    instanceInfo
  });

  // Wrapper for trackInvocation with current context
  const trackInvocationWithContext = (tools: any, method: string, targetName: string) => {
    return trackInvocation(tools, method, targetName, wallet, setTransactions);
  };

  const handleTerminate = async () => {
    try {
      const result = await contractService.terminate(terminateMessage, trackInvocationWithContext);
      
      if (result.success) {
        setTerminateMessage('');
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Terminate action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpgrade = async () => {
    try {
      const result = await contractService.upgrade(upgradeBundleId, trackInvocationWithContext);
      
      if (result.success) {
        setUpgradeBundleId('');
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Upgrade action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleInstallAndStart = async () => {
    try {
      const result = await contractService.installAndStart(installBundleId, trackInvocationWithContext);
      
      if (result.success) {
        setInstallBundleId('');
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Install and start action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleGetCreatorFacet = async () => {
    try {
      const result = await contractService.getCreatorFacet(creatorFacetName, trackInvocationWithContext);
      
      alert(result.message);
    } catch (error) {
      alert(`Get creator facet failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeliverPlannerInvitation = async () => {
    try {
      const result = await contractService.deliverPlannerInvitation(plannerAddress, trackInvocationWithContext);
      
      if (result.success) {
        setPlannerAddress('');
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Deliver planner invitation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRedeemInvitation = async (description: string, saveName: string, replace: boolean) => {
    try {
      await redeemInvitation({
        description,
        saveName,
        replace,
        invitations,
        purses,
        wallet,
        setPendingEntries
      });
      
      alert(`Successfully redeemed and saved as "${saveName}"`);
    } catch (error) {
      console.error('Redeem invitation failed:', error);
      alert(`Redeem invitation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEnvironment = e.target.value as Environment;
    setEnvironment(newEnvironment);
    localStorage.setItem('agoricEnvironment', newEnvironment);

    // Update endpoints with new environment configuration
    const newEndpoints = configureEndpoints(newEnvironment);
    setENDPOINTS(newEndpoints);

    // Clear instance info when switching networks
    setInstanceInfo(null);
    setInstanceBlockHeight(null);

    // If wallet was connected, show refresh message
    if (wallet) {
      alert(
        'Environment changed. Please refresh the page to reconnect the wallet with the new environment.',
      );
    }
  };

  // Initialize watcher and vstorage client
  useEffect(() => {
    const watcher = makeAgoricChainStorageWatcher(ENDPOINTS.API, ENDPOINTS.CHAIN_ID);
    watcherRef.current = watcher;

    // Create vstorage client for transaction history
    const vsc = makeVStorage({ fetch }, { rpcAddrs: [ENDPOINTS.RPC] });
    setVstorageClient(vsc);

    // Watch for instance updates
    watcher.watchLatest<Array<[string, unknown]>>(
      [Kind.Data, 'published.agoricNames.instance'],
      instances => {
        console.log('Admin got instances', instances);
        const findInstance = (name: string) => {
          const instancePair = instances.find(([n]: [string, unknown]) => n === name);
          return instancePair ? String(instancePair[1]) : undefined;
        };

        const ymax0 = findInstance('ymax0');
        const postalService = findInstance('postalService');
        setInstanceInfo({ ymax0, postalService });
      },
    );

    // Fetch block height
    const fetchInstanceBlockHeight = async () => {
      try {
        const { readLatestHead } = makeVstorageKit({ fetch }, ENDPOINTS.RPC);
        const head = await readLatestHead('published.agoricNames.instance');
        setInstanceBlockHeight(head?.blockHeight || null);
      } catch (e) {
        console.warn('Could not get block height for instances:', e);
        setInstanceBlockHeight(null);
      }
    };
    fetchInstanceBlockHeight();

    return () => {
      // Cleanup watcher if needed
      watcherRef.current = null;
    };
  }, [ENDPOINTS]);

  // Handle invocation completions
  useEffect(() => {
    if (!effectiveAddress || !watcherRef.current) return;

    const walletUpdatesPath = `published.wallet.${effectiveAddress}`;
    watcherRef.current.watchLatest<any>(
      [Kind.Data, walletUpdatesPath],
      (walletData) => {
        handleInvocationCompletion(walletData, fetchTransactions);
      }
    );
  }, [effectiveAddress, watcherRef.current, handleInvocationCompletion, fetchTransactions]);

  // Extract saved entries from transaction history and merge with wallet state
  useEffect(() => {
    if (transactions.length > 0) {
      const savedNamesFromTx = new Set<string>();
      
      transactions.forEach(tx => {
        const message = tx.tx?.body?.messages?.[0];
        const saveResultName = extractSaveResultName(message);
        if (saveResultName) {
          savedNamesFromTx.add(saveResultName);
        }
      });
      
      console.log('Admin: Extracted saved entries from transactions:', Array.from(savedNamesFromTx));
      
      // Merge with existing saved entries from wallet state
      setSavedEntries(prev => {
        const merged = new Set([...prev, ...savedNamesFromTx]);
        return merged;
      });
    }
  }, [transactions]);

  // Handle URL parameter for watch mode and set default addresses
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const watchParam = urlParams.get('watch');
    if (watchParam) {
      setWatchAddress(watchParam);
    } else if (!wallet) {
      // Set default watch address based on environment
      const defaultAddresses = {
        devnet: 'agoric10utru593dspjwfewcgdak8lvp9tkz0xttvcnxv',
        mainnet: 'agoric1e80twfutmrm3wrk3fysjcnef4j82mq8dn6nmcq',
        localhost: ''
      };
      setWatchAddress(defaultAddresses[environment] || '');
    }
  }, [environment]);

  const handleWatchAddress = () => {
    if (watchAddress.trim()) {
      // Update URL to reflect watch mode
      const url = new URL(window.location.href);
      url.searchParams.set('watch', watchAddress.trim());
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Render wallet connection or watch address input
  const renderConnectionSection = () => (
    <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Connection</h2>
      
      {wallet ? (
        <div style={{ color: 'green', fontWeight: 'bold' }}>
          ✅ Connected: {wallet.address}
        </div>
      ) : watchAddress ? (
        <div style={{ color: 'blue', fontWeight: 'bold' }}>
          👁️ Watching: {watchAddress}
        </div>
      ) : null}
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
        <button onClick={tryConnectWallet} disabled={!!wallet}>
          {wallet ? 'Wallet Connected' : 'Connect Wallet'}
        </button>
        
        <span>or</span>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter address to watch..."
            value={watchAddress}
            onChange={(e) => setWatchAddress(e.target.value)}
            disabled={!!wallet}
            style={{ 
              padding: '0.5rem', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              minWidth: '300px'
            }}
          />
          <button 
            onClick={handleWatchAddress}
            disabled={!!wallet || !watchAddress.trim()}
          >
            Watch
          </button>
        </div>
      </div>
    </div>
  );

  if (!wallet && !watchAddress) {
    return (
      <div>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <h1 style={{ textAlign: 'left' }}>YMax Contract Control</h1>
          
          <div className="environment-selector" style={{ position: 'absolute', top: 0, right: 0 }}>
            <label htmlFor="environment-select">Env: </label>
            <select
              id="environment-select"
              value={environment}
              onChange={handleEnvironmentChange}
            >
              <option value="mainnet">Mainnet</option>
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
        {renderConnectionSection()}
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: !wallet && watchAddress ? '#f0f8ff' : 'white',
      minHeight: '100vh',
      padding: !wallet && watchAddress ? '1rem' : '0'
    }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <h1 style={{ textAlign: 'left' }}>
          YMax Contract Control
          {!wallet && watchAddress && (
            <span style={{ 
              fontSize: '0.6em', 
              color: '#666', 
              fontWeight: 'normal',
              marginLeft: '1rem'
            }}>
              (Read-Only Mode)
            </span>
          )}
        </h1>
        
        <div className="environment-selector" style={{ position: 'absolute', top: 0, right: 0 }}>
          <label htmlFor="environment-select">Env: </label>
          <select
            id="environment-select"
            value={environment}
            onChange={handleEnvironmentChange}
          >
            <option value="mainnet">Mainnet</option>
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

      {renderConnectionSection()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <WalletEntriesCard
          invitations={invitations}
          savedEntries={savedEntries}
          pendingEntries={pendingEntries}
          onRedeemInvitation={handleRedeemInvitation}
          walletAddress={effectiveAddress}
          readOnly={!wallet}
        />

        <ContractControlCard
          instanceInfo={instanceInfo}
          instanceBlockHeight={instanceBlockHeight}
          creatorFacetName={creatorFacetName}
          setCreatorFacetName={setCreatorFacetName}
          terminateMessage={terminateMessage}
          setTerminateMessage={setTerminateMessage}
          upgradeBundleId={upgradeBundleId}
          setUpgradeBundleId={setUpgradeBundleId}
          installBundleId={installBundleId}
          setInstallBundleId={setInstallBundleId}
          savedEntries={savedEntries}
          onGetCreatorFacet={handleGetCreatorFacet}
          onTerminate={handleTerminate}
          onUpgrade={handleUpgrade}
          onInstallAndStart={handleInstallAndStart}
          readOnly={!wallet}
        />

        <CreatorFacetCard
          plannerAddress={plannerAddress}
          setPlannerAddress={setPlannerAddress}
          savedEntries={savedEntries}
          onDeliverPlannerInvitation={handleDeliverPlannerInvitation}
          readOnly={!wallet}
        />

        {pendingInvocations.size > 0 && (
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              Pending Invocations ({pendingInvocations.size})
            </h3>
            <div style={{ fontSize: '0.9em', color: '#666' }}>
              {Array.from(pendingInvocations).map(id => (
                <div key={id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '0.25rem'
                }}>
                  <span style={{ 
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'orange',
                    animation: 'pulse 2s infinite'
                  }}></span>
                  ID: {id}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TransactionHistory 
        transactions={transactions} 
        transactionLimit={transactionLimit}
        onTransactionLimitChange={setTransactionLimit}
        walletAddress={effectiveAddress}
        vsc={vstorageClient}
        marshaller={watcherRef.current?.marshaller}
        pendingInvocations={pendingInvocations}
        walletUpdates={walletUpdates}
      />
    </div>
  );
};

export default Admin;
