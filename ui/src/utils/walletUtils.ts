import {
  makeAgoricChainStorageWatcher,
  AgoricChainStoragePathKind as Kind,
} from '@agoric/rpc';

export type WalletState = {
  liveOffers: Array<[string, any]>;
  offerToPublicSubscriberPaths: Array<[string, any]>;
  offerToUsedInvitation: Array<[string, any]>;
  purses: Array<any>;
};

export type ParsedOffer = {
  id: string;
  description?: string;
  invitationSpec?: any;
  offerArgs?: any;
  proposal?: any;
};

/**
 * Parses a vstorage wallet state entry to extract structured data
 */
export const parseWalletStateEntry = (entry: any): WalletState | null => {
  try {
    console.log('Parsing entry:', entry);
    if (!entry || !entry.body) {
      console.log('Entry missing or no body:', entry);
      return null;
    }

    // Remove the # prefix if present
    let bodyStr = entry.body;
    console.log('Raw body string:', bodyStr);
    if (bodyStr.startsWith('#')) {
      bodyStr = bodyStr.substring(1);
    }
    console.log('Body string after removing #:', bodyStr);

    const parsed = JSON.parse(bodyStr);
    console.log('Parsed wallet state:', parsed);
    return parsed;
  } catch (error) {
    console.warn('Failed to parse wallet state entry:', error, entry);
    return null;
  }
};

/**
 * Extracts offer information from wallet state data
 */
export const extractOffersFromWalletState = (walletState: WalletState): ParsedOffer[] => {
  const offers: ParsedOffer[] = [];
  console.log('Extracting offers from wallet state:', walletState);

  // Extract from liveOffers
  if (walletState.liveOffers) {
    console.log('Found liveOffers:', walletState.liveOffers);
    for (const [offerId, offerData] of walletState.liveOffers) {
      console.log('Processing live offer:', offerId, offerData);
      offers.push({
        id: offerId.toString(),
        invitationSpec: offerData.invitationSpec,
        offerArgs: offerData.offerArgs,
        proposal: offerData.proposal,
      });
    }
  } else {
    console.log('No liveOffers found');
  }

  // Extract from offerToUsedInvitation to get descriptions
  if (walletState.offerToUsedInvitation && Array.isArray(walletState.offerToUsedInvitation)) {
    console.log('Found offerToUsedInvitation array with', walletState.offerToUsedInvitation.length, 'entries:', walletState.offerToUsedInvitation);

    for (let i = 0; i < walletState.offerToUsedInvitation.length; i++) {
      const entry = walletState.offerToUsedInvitation[i];
      console.log(`Processing offerToUsedInvitation entry ${i}:`, entry);

      if (Array.isArray(entry) && entry.length >= 2) {
        const [offerId, invitationData] = entry;
        console.log('Processing used invitation:', offerId, invitationData);

        if (invitationData && invitationData.value && Array.isArray(invitationData.value)) {
          const invitation = invitationData.value[0];
          console.log('Invitation details:', invitation);

          if (invitation && invitation.description) {
            console.log('Found invitation with description:', invitation.description);
            const existingOffer = offers.find(offer => offer.id === offerId.toString());
            if (existingOffer) {
              existingOffer.description = invitation.description;
              console.log('Updated existing offer with description:', existingOffer);
            } else {
              const newOffer = {
                id: offerId.toString(),
                description: invitation.description,
              };
              offers.push(newOffer);
              console.log('Added new offer with description:', newOffer);
            }
          } else {
            console.log('No description found in invitation:', invitation);
          }
        } else {
          console.log('Invalid invitation data structure:', invitationData);
        }
      } else {
        console.log('Invalid entry structure:', entry);
      }
    }
  } else {
    console.log('No offerToUsedInvitation array found');
  }

  console.log('Final extracted offers:', offers);
  return offers;
};

/**
 * Finds the most recent offer ID with a specific description
 */
export const findLatestOfferByDescription = (offers: ParsedOffer[], description: string): string | null => {
  const matchingOffers = offers.filter(offer => offer.description === description);

  if (matchingOffers.length === 0) {
    console.log(`No offers found with description: ${description}`);
    return null;
  }

  // Sort by ID - handle both timestamp-only IDs and prefixed IDs
  const sortedOffers = matchingOffers.sort((a, b) => {
    // Extract timestamp from offer ID
    // Handle cases like "1759417599404" or "redeem-2025-09-05T10:15:29.259Z"
    const extractTimestamp = (id: string): number => {
      // If it's a pure number (timestamp), use it directly
      if (/^\d+$/.test(id)) {
        return parseInt(id);
      }

      // If it has a date format, extract timestamp from the date
      const dateMatch = id.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
      if (dateMatch) {
        return new Date(dateMatch[1]).getTime();
      }

      // Fallback: try to parse as number anyway
      const numMatch = id.match(/\d+/);
      return numMatch ? parseInt(numMatch[0]) : 0;
    };

    const aTimestamp = extractTimestamp(a.id);
    const bTimestamp = extractTimestamp(b.id);
    return bTimestamp - aTimestamp;
  });

  const result = sortedOffers[0].id;
  console.log(`Selected latest ${description} offer ID: ${result} (from ${matchingOffers.length} candidates)`);

  return result;
};

/**
 * Fetches and parses wallet state from vstorage
 */
export const fetchWalletState = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
  walletAddress: string,
): Promise<ParsedOffer[]> => {
  return new Promise((resolve, reject) => {
    try {
      const path = `published.wallet.${walletAddress}.current`;
      console.log('Watching vstorage path:', path);

      // Use watchLatest to get the current state
      const unsubscribe = watcher.watchLatest<any>(
        [Kind.Data, path],
        (data) => {
          try {
            console.log('Raw vstorage data received:', data);

            if (!data) {
              console.log('No data received from vstorage');
              resolve([]);
              return;
            }

            let walletState: WalletState;

            // Check if data is already a wallet state object (current behavior)
            if (data.liveOffers !== undefined && data.offerToUsedInvitation !== undefined) {
              console.log('Data is already a wallet state object');
              walletState = data;
            }
            // Handle array of entries (original expected format) 
            else if (Array.isArray(data)) {
              console.log('Processing', data.length, 'entries from vstorage');

              // Take the latest entry (last one in the array)
              const latestEntry = data[data.length - 1];
              console.log('Latest entry:', latestEntry);

              const parsedState = parseWalletStateEntry(latestEntry);
              if (!parsedState) {
                console.log('Failed to parse latest entry');
                resolve([]);
                return;
              }
              walletState = parsedState;
            } else {
              console.log('Unknown data format:', typeof data, data);
              resolve([]);
              return;
            }

            console.log('Processing wallet state:', walletState);

            // Extract offers from the wallet state
            const offers = extractOffersFromWalletState(walletState);
            console.log('Final extracted offers:', offers);

            resolve(offers);

            // Unsubscribe after getting the data
            if (unsubscribe) {
              unsubscribe();
            }
          } catch (error) {
            console.error('Error parsing wallet state:', error);
            reject(error);
          }
        }
      );

      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (unsubscribe) {
          unsubscribe();
        }
        reject(new Error('Timeout fetching wallet state'));
      }, 10000); // 10 second timeout

    } catch (error) {
      console.error('Error setting up wallet state watcher:', error);
      reject(error);
    }
  });
};

/**
 * Gets the latest openPortfolio offer ID for a wallet
 */
export const getLatestOpenPortfolioOfferId = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
  walletAddress: string,
): Promise<string | null> => {
  try {
    console.log('Starting getLatestOpenPortfolioOfferId for:', walletAddress);
    const offers = await fetchWalletState(watcher, walletAddress);
    console.log('Received offers:', offers);
    const result = findLatestOfferByDescription(offers, 'openPortfolio');
    console.log('Latest openPortfolio offer ID:', result);
    return result;
  } catch (error) {
    console.error('Error fetching latest openPortfolio offer ID:', error);
    return null;
  }
};

/**
 * Gets the latest resolver offer ID for a wallet (used for settle transactions)
 */
export const getLatestResolverOfferId = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
  walletAddress: string,
): Promise<string | null> => {
  try {
    console.log('Starting getLatestResolverOfferId for:', walletAddress);
    const offers = await fetchWalletState(watcher, walletAddress);
    console.log('Received offers:', offers);
    const result = findLatestOfferByDescription(offers, 'resolver');
    console.log('Latest resolver offer ID:', result);
    return result;
  } catch (error) {
    console.error('Error fetching latest resolver offer ID:', error);
    return null;
  }
};

export type PendingTransaction = {
  id: string;
  amount: string;
  destinationAddress: string;
  status: string;
  type: string;
};

/**
 * Parses a vstorage transaction entry to extract transaction data
 */
export const parseTransactionEntry = (entry: any): PendingTransaction | null => {
  try {
    console.log('Parsing transaction entry:', entry);

    // Handle different possible data structures
    let bodyStr = '';

    // Check if entry is an array (like the example: [{ body: "#JSON", slots: [] }])
    if (Array.isArray(entry) && entry.length > 0 && entry[0].body) {
      bodyStr = entry[0].body;
      console.log('Found body in array format:', bodyStr);
    }
    // Check if entry has body directly
    else if (entry && entry.body) {
      bodyStr = entry.body;
      console.log('Found body directly:', bodyStr);
    }
    // Check if entry is already the body string
    else if (typeof entry === 'string') {
      bodyStr = entry;
      console.log('Entry is already body string:', bodyStr);
    }
    else {
      console.log('No valid body found in entry:', entry);
      return null;
    }

    // Remove the # prefix if present
    if (bodyStr.startsWith('#')) {
      bodyStr = bodyStr.substring(1);
    }
    console.log('Body string after removing #:', bodyStr);

    const parsed = JSON.parse(bodyStr);
    console.log('Parsed transaction data:', parsed);

    return {
      id: '', // Will be set by caller
      amount: parsed.amount || '',
      destinationAddress: parsed.destinationAddress || '',
      status: parsed.status || '',
      type: parsed.type || '',
    };
  } catch (error) {
    console.warn('Failed to parse transaction entry:', error, entry);
    return null;
  }
};

/**
 * Fetches individual transaction data from a specific transaction path
 */
const fetchIndividualTransaction = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
  txId: string,
): Promise<PendingTransaction | null> => {
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let unsubscribe: (() => void) | null = null;
    
    const cleanup = () => {
      if (unsubscribe && !isResolved) {
        try {
          unsubscribe();
        } catch (error) {
          // Ignore "already stopped watching" errors
          if (!error.message?.includes('already stopped watching')) {
            console.warn(`Error during cleanup for ${txId}:`, error);
          }
        }
        unsubscribe = null;
      }
    };

    const resolveOnce = (result: PendingTransaction | null) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(result);
      }
    };

    try {
      const path = `published.ymax0.pendingTxs.${txId}`;
      console.log(`Fetching individual transaction data from: ${path}`);

      unsubscribe = watcher.watchLatest<any>(
        [Kind.Data, path],
        (data) => {
          try {
            console.log(`Raw transaction data for ${txId}:`, data);

            if (!data || data === '') {
              console.log(`No data found for transaction ${txId}`);
              resolveOnce(null);
              return;
            }

            // Check if data is already a transaction object or needs parsing
            let parsedTx: PendingTransaction | null = null;
            
            if (data && typeof data === 'object' && data.status && data.type) {
              // Data is already in the correct format
              console.log(`Transaction ${txId} data is already in correct format`);
              parsedTx = {
                id: txId,
                amount: data.amount ? String(data.amount) : '',
                destinationAddress: data.destinationAddress || '',
                status: data.status || '',
                type: data.type || '',
              };
            } else {
              // Try to parse using the existing parser
              parsedTx = parseTransactionEntry(data);
              if (parsedTx) {
                parsedTx.id = txId;
              }
            }
            
            if (parsedTx) {
              console.log(`Successfully parsed transaction ${txId}:`, parsedTx);
              resolveOnce(parsedTx);
            } else {
              console.log(`Failed to parse transaction data for ${txId}`);
              resolveOnce(null);
            }
          } catch (error) {
            console.error(`Error parsing transaction ${txId}:`, error);
            resolveOnce(null);
          }
        }
      );

      // Set a timeout to prevent hanging on individual transactions
      setTimeout(() => {
        if (!isResolved) {
          console.log(`Timeout fetching transaction ${txId}`);
          resolveOnce(null);
        }
      }, 5000); // 5 second timeout per transaction

    } catch (error) {
      console.error(`Error setting up watcher for transaction ${txId}:`, error);
      resolveOnce(null);
    }
  });
};

/**
 * Fetches all transactions from ymax0 vstorage path
 */
export const fetchAllTransactions = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
): Promise<PendingTransaction[]> => {
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let unsubscribe: (() => void) | null = null;
    
    const cleanup = () => {
      if (unsubscribe && !isResolved) {
        try {
          unsubscribe();
        } catch (error) {
          // Ignore "already stopped watching" errors
          if (!error.message?.includes('already stopped watching')) {
            console.warn('Error during cleanup:', error);
          }
        }
        unsubscribe = null;
      }
    };

    const resolveOnce = (result: PendingTransaction[]) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(result);
      }
    };

    const rejectOnce = (error: Error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(error);
      }
    };

    try {
      const path = 'published.ymax0.pendingTxs';
      console.log('Watching all transactions at path:', path);

      // Use watchLatest to get the current state
      unsubscribe = watcher.watchLatest<any>(
        [Kind.Children, path],
        async (data) => {
          try {
            console.log('Raw pending transactions data received:', data);
            console.log('Data type:', typeof data);
            console.log('Data === null:', data === null);
            console.log('Data === undefined:', data === undefined);
            console.log('Data length (if array):', Array.isArray(data) ? data.length : 'not array');
            console.log('Object keys (if object):', typeof data === 'object' && data !== null ? Object.keys(data) : 'not object');

            // Handle empty data - could be null, undefined, empty string, or empty object
            if (!data ||
              data === '' ||
              (typeof data === 'object' && data !== null && Object.keys(data).length === 0)) {
              console.log('No pending transactions data received, empty string, or empty object');
              resolveOnce([]);
              return;
            }

            const transactions: PendingTransaction[] = [];

            // Try to parse as JSON string if it's a string
            let parsedData = data;
            if (typeof data === 'string' && data.trim().length > 0) {
              try {
                parsedData = JSON.parse(data);
                console.log('Successfully parsed JSON string:', parsedData);
              } catch (e) {
                console.log('Data is string but not valid JSON:', data);
                console.log('String length:', data.length);
                console.log('String content (first 100 chars):', data.substring(0, 100));
                resolveOnce([]);
                return;
              }
            }

            // Handle different possible data structures
            if (typeof parsedData === 'object' && parsedData !== null) {
              // Check if parsedData is an array
              if (Array.isArray(parsedData)) {
                console.log('Parsed data is an array, processing entries...');
                
                // When using Kind.Children, we get an array of transaction IDs (like ["tx0", "tx1", "tx2"])
                // We need to fetch each transaction's data individually
                console.log(`Found ${parsedData.length} transaction IDs, fetching individual data...`);
                
                // Collect all individual transaction fetch promises
                const transactionPromises = parsedData.map(async (item, index) => {
                  console.log(`Processing array item ${index}:`, item);
                  
                  // If the item is just a transaction ID string, fetch its data individually
                  if (typeof item === 'string' && item.startsWith('tx')) {
                    const txId = item;
                    console.log(`Fetching individual data for transaction ID: ${txId}`);
                    return await fetchIndividualTransaction(watcher, txId);
                  } else {
                    // If the item is already transaction data, parse it normally
                    const txId = `tx${index}`;
                    const parsedTx = parseTransactionEntry(item);
                    if (parsedTx) {
                      parsedTx.id = txId;
                      console.log(`Added transaction: ${txId}`, parsedTx);
                      return parsedTx;
                    } else {
                      console.log(`Failed to parse transaction ${txId}`);
                      return null;
                    }
                  }
                });
                
                // Wait for all individual transaction fetches to complete
                const fetchedTransactions = await Promise.all(transactionPromises);
                
                // Filter out null results and add to transactions array
                fetchedTransactions.forEach(tx => {
                  if (tx) {
                    transactions.push(tx);
                  }
                });
                
                // Sort transactions in reverse order (latest first)
                transactions.sort((a, b) => {
                  const getNumericId = (id: string): number => {
                    const match = id.match(/tx(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                  };
                  
                  const aNum = getNumericId(a.id);
                  const bNum = getNumericId(b.id);
                  
                  return bNum - aNum; // Reverse order (latest first)
                });
              } else {
                // parsedData is an object - iterate through keys (tx0, tx1, etc.)
                console.log('Parsed data is an object, processing entries...');
                Object.entries(parsedData).forEach(([txId, txData]: [string, any]) => {
                  console.log(`Processing object transaction ${txId}:`, txData);

                  // Parse the transaction data
                  const parsedTx = parseTransactionEntry(txData);
                  if (parsedTx) {
                    parsedTx.id = txId;
                    transactions.push(parsedTx);
                    console.log(`Added transaction: ${txId}`, parsedTx);
                  } else {
                    console.log(`Failed to parse transaction ${txId}`);
                  }
                });
                
                // Sort transactions in reverse order (latest first) for object case too
                transactions.sort((a, b) => {
                  const getNumericId = (id: string): number => {
                    const match = id.match(/tx(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                  };
                  
                  const aNum = getNumericId(a.id);
                  const bNum = getNumericId(b.id);
                  
                  return bNum - aNum; // Reverse order (latest first)
                });
              }
            } else {
              console.log('Unexpected data format for pending transactions:', typeof parsedData, parsedData);
            }

            console.log('Final transactions:', transactions);
            resolveOnce(transactions);
          } catch (error) {
            console.error('Error parsing pending transactions:', error);
            rejectOnce(error instanceof Error ? error : new Error('Unknown parsing error'));
          }
        }
      );

      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (!isResolved) {
          console.log('Timeout fetching all transactions');
          rejectOnce(new Error('Timeout fetching pending transactions'));
        }
      }, 10000); // 10 second timeout

    } catch (error) {
      console.error('Error setting up pending transactions watcher:', error);
      rejectOnce(error instanceof Error ? error : new Error('Unknown error'));
    }
  });
};

/**
 * Test function to check if vstorage path exists
 */
export const testVstoragePath = async (
  watcher: ReturnType<typeof makeAgoricChainStorageWatcher>,
  walletAddress: string,
): Promise<void> => {
  console.log('=== TESTING VSTORAGE PATHS ===');
  console.log('Wallet address:', walletAddress);

  // Test different path formats
  const testPaths = [
    `published.wallet.${walletAddress}.current`,
    `published.wallet.${walletAddress}`,
    `wallet.${walletAddress}.current`,
    `wallet.${walletAddress}`,
    'published.ymax0.pendingTxs',
  ];

  for (const path of testPaths) {
    console.log(`Testing path: ${path}`);
    try {
      const unsubscribe = watcher.watchLatest<any>(
        [Kind.Data, path],
        (data) => {
          console.log(`✅ SUCCESS - Data from ${path}:`, data);
          if (unsubscribe) {
            unsubscribe();
          }
        }
      );

      // Clean up after 3 seconds per path
      setTimeout(() => {
        if (unsubscribe) {
          console.log(`⏰ Timeout cleanup for ${path}`);
          unsubscribe();
        }
      }, 3000);

    } catch (error) {
      console.error(`❌ ERROR watching ${path}:`, error);
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('=== VSTORAGE TEST COMPLETE ===');
};