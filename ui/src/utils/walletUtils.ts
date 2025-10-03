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
  const matchingOffers = offers
    .filter(offer => offer.description === description)
    .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Sort by ID descending (most recent first)
  
  return matchingOffers.length > 0 ? matchingOffers[0].id : null;
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
              
              walletState = parseWalletStateEntry(latestEntry);
              if (!walletState) {
                console.log('Failed to parse latest entry');
                resolve([]);
                return;
              }
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