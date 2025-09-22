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

const Admin: React.FC<AdminProps> = ({
  signAndBroadcastAction,
  wallet,
  tryConnectWallet,
  instances,
  purses,
  keplr,
  chainId,
}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [instanceInfo, setInstanceInfo] = useState<{
    ymax0?: string;
    postalService?: string;
  } | null>(null);
  const [instanceBlockHeight, setInstanceBlockHeight] = useState<string | null>(null);
  const [terminateMessage, setTerminateMessage] = useState<string>('');
  const [upgradeBundleId, setUpgradeBundleId] = useState<string>('');
  const [installBundleId, setInstallBundleId] = useState<string>('');
  const [creatorFacetName, setCreatorFacetName] = useState<string>('creatorFacet');
  const [plannerAddress, setPlannerAddress] = useState<string>('');
  const [environment, setEnvironment] = useState<Environment>(getInitialEnvironment());
  const [ENDPOINTS, setENDPOINTS] = useState(configureEndpoints(getInitialEnvironment()));
  const watcherRef = useRef<ReturnType<typeof makeAgoricChainStorageWatcher> | null>(null);
  
  // Wallet entries state
  const [invitations, setInvitations] = useState<Array<[string, number]>>([]);
  const [savedEntries, setSavedEntries] = useState<Set<string>>(new Set());
  const [pendingEntries, setPendingEntries] = useState<Set<string>>(new Set());
  const [transactionLimit, setTransactionLimit] = useState<number>(10);
  const [vstorageClient, setVstorageClient] = useState<any>(null);
  const [pendingInvocations, setPendingInvocations] = useState<Set<number>>(new Set());
  const [walletUpdates, setWalletUpdates] = useState<any[]>([]);

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

  // Helper function to track invocations consistently
  const trackInvocation = (tools: any, method: string, targetName: string) => {
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
                  args: [], // We don't have the actual args here
                }
              })}`,
              slots: []
            })
          }]
        }
      }
    };
    
    // Add to transactions list immediately
    setTransactions(prev => [mockTransaction, ...prev]);
    
    return invocationId;
  };

  const handleTerminate = async () => {
    try {
      const result = await contractService.terminate(terminateMessage, trackInvocation);
      
      if (result.success) {
        setTerminateMessage(''); // Clear the form
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Terminate action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpgrade = async () => {
    try {
      const result = await contractService.upgrade(upgradeBundleId, trackInvocation);
      
      if (result.success) {
        setUpgradeBundleId(''); // Clear the form
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Upgrade action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleInstallAndStart = async () => {
    try {
      const result = await contractService.installAndStart(installBundleId, trackInvocation);
      
      if (result.success) {
        setInstallBundleId(''); // Clear the form
      }
      
      alert(result.message);
    } catch (error) {
      alert(`Install and start action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleGetCreatorFacet = async () => {
    try {
      const result = await contractService.getCreatorFacet(creatorFacetName, trackInvocation);
      
      alert(result.message);
    } catch (error) {
      alert(`Get creator facet failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeliverPlannerInvitation = async () => {
    try {
      const result = await contractService.deliverPlannerInvitation(plannerAddress, trackInvocation);
      
      if (result.success) {
        setPlannerAddress(''); // Clear the form
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

  // Watch wallet state for invitations, track pending entries, and get saved entries
  useEffect(() => {
    if (!wallet || !watcherRef.current) return;

    // Get invitations from purses (from app store, not wallet.purses)
    const invitationPurse = purses?.find((p: any) => p.brandPetname === 'Invitation');
    console.log('Admin: invitation purse:', invitationPurse);
    if (invitationPurse?.currentAmount?.value && Array.isArray(invitationPurse.currentAmount.value)) {
      // Show each invitation individually with just the description
      const invitationList = invitationPurse.currentAmount.value.map((invitation: any, index: number) => {
        const desc = invitation.description || 'unknown';
        return [desc, index] as [string, number]; // Use index as identifier, description as display
      });
      setInvitations(invitationList);
    }

    // Watch wallet's current state for pending entries and saved entries
    const walletPath = `published.wallet.${wallet.address}.current`;
    console.log('Admin: Watching wallet state at', walletPath);
    
    watcherRef.current.watchLatest<any>(
      [Kind.Data, walletPath],
      (walletRecord) => {
        console.log('Admin: Got wallet record', walletRecord);
        
        if (walletRecord?.liveOffers) {
          const currentPending = new Set<string>();
          
          // Check live offers for saveResult entries (these are pending)
          walletRecord.liveOffers.forEach(([offerId, offerSpec]: [string, any]) => {
            if (offerSpec?.saveResult?.name) {
              currentPending.add(offerSpec.saveResult.name);
            }
          });
          
          setPendingEntries(currentPending);
        }

        // Extract saved entries from wallet record
        if (walletRecord) {
          const currentSaved = new Set<string>();
          
          // Look for saved entries - these are top-level properties that aren't wallet internals
          const walletInternalKeys = new Set([
            'liveOffers', 
            'offerToPublicSubscriberPaths', 
            'offerToUsedInvitation',
            'purses',
            'offerToInvitationSpec'
          ]);
          
          Object.keys(walletRecord).forEach(key => {
            // Skip wallet internal properties
            if (!walletInternalKeys.has(key) && 
                typeof walletRecord[key] === 'object' && 
                walletRecord[key] !== null) {
              currentSaved.add(key);
            }
          });
          
          console.log('Admin: Found saved entries in wallet record:', Array.from(currentSaved));
          setSavedEntries(currentSaved);
        }
      }
    );

    // Watch for invocation completions to remove from pending
    const walletUpdatesPath = `published.wallet.${wallet.address}`;
    console.log('Admin: Setting up wallet updates watcher for path:', walletUpdatesPath);
    
    watcherRef.current.watchLatest<any>(
      [Kind.Data, walletUpdatesPath],
      (walletData) => {
        console.log('Admin: Got wallet updates data:', walletData);
        
        // Chain storage watcher provides deserialized data directly
        console.log('Admin: Processing wallet update (deserialized)');
        
        if (walletData && typeof walletData === 'object' && walletData.updated === 'invocation' && walletData.id && (walletData.result !== undefined || walletData.error)) {
          console.log('Admin: Found completed invocation:', walletData.id);
          // Remove completed invocation from pending
          setPendingInvocations(prev => {
            const newSet = new Set(prev);
            const wasRemoved = newSet.delete(walletData.id);
            console.log('Admin: Removed invocation', walletData.id, 'from pending:', wasRemoved);
            return newSet;
          });
          
          // Add to wallet updates for real-time completion status
          setWalletUpdates(prev => [...prev, walletData]);
          
          // Trigger transaction refetch when invocation completes
          fetchTransactions();
        }
      }
    );
    
  }, [wallet, purses, watcherRef.current]);

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

  // Extract fetchTransactions function to be reusable
  const fetchTransactions = async () => {
    if (!wallet?.address) return;
    
    const url = `${ENDPOINTS.API}/cosmos/tx/v1beta1/txs?events=message.sender='${wallet.address}'&order_by=ORDER_BY_DESC&limit=${transactionLimit}`;
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
  }, [wallet?.address, ENDPOINTS, transactionLimit]);

  // IMPORTANT: Keep this blank line before return - required for TSX export syntax
  if (!wallet) {
    return (
      <div>
        <h1 style={{ textAlign: 'left' }}>YMax Contract Control</h1>
        <p style={{ textAlign: 'left' }}>Please connect your wallet to continue.</p>
        <button onClick={tryConnectWallet}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <WalletEntriesCard
          invitations={invitations}
          savedEntries={savedEntries}
          pendingEntries={pendingEntries}
          onRedeemInvitation={handleRedeemInvitation}
          walletAddress={wallet.address}
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
        />

        <CreatorFacetCard
          plannerAddress={plannerAddress}
          setPlannerAddress={setPlannerAddress}
          savedEntries={savedEntries}
          onDeliverPlannerInvitation={handleDeliverPlannerInvitation}
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
        walletAddress={wallet?.address}
        vsc={vstorageClient}
        marshaller={watcherRef.current?.marshaller}
        pendingInvocations={pendingInvocations}
        walletUpdates={walletUpdates}
      />
    </div>
  );
};

export default Admin;
