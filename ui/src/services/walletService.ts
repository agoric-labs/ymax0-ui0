export interface WalletService {
  makeOffer: (
    invitation: any,
    proposal: any,
    payments: any,
    callback: (update: { status: string; data?: unknown }) => void,
    offerId: string,
    options?: { saveResult?: { name: string; overwrite: boolean } }
  ) => Promise<void>;
  address: string;
}

export interface RedeemInvitationParams {
  description: string;
  saveName: string;
  replace: boolean;
  invitations: Array<[string, number]>;
  purses?: Array<any>;
  wallet: WalletService;
  setPendingEntries: (updater: (prev: Set<string>) => Set<string>) => void;
}

export const redeemInvitation = async ({
  description,
  saveName,
  replace,
  invitations,
  purses,
  wallet,
  setPendingEntries
}: RedeemInvitationParams): Promise<void> => {
  if (!saveName.trim()) {
    throw new Error('Please enter a name to save the result');
  }

  // Find the invitation with matching description from the purse
  const invitationPurse = purses?.find((p: any) => p.brandPetname === 'Invitation');
  if (!invitationPurse?.currentAmount?.value || !Array.isArray(invitationPurse.currentAmount.value)) {
    throw new Error('No invitations found in purse');
  }

  // Description is the actual description, but we need to find the invitation by index
  // The invitation list stores [description, index] pairs
  const invitationEntry = invitations.find(([desc]) => desc === description);
  if (!invitationEntry) {
    throw new Error(`Invitation with description "${description}" not found`);
  }
  
  const invitationIndex = invitationEntry[1] as number;
  const invitation = invitationPurse.currentAmount.value[invitationIndex];
  if (!invitation) {
    throw new Error(`Invitation not found at index ${invitationIndex}`);
  }

  // Create offer to redeem invitation using the actual instance from the invitation
  const offerId = `redeem-${new Date().toISOString()}`;
  
  await wallet.makeOffer(
    {
      source: 'purse',
      instance: invitation.instance,
      description: description,
    },
    {},
    undefined,
    (update: { status: string; data?: unknown }) => {
      console.log('Redeem offer update:', update);
      if (update.status === 'accepted') {
        // Don't update state here - let the wallet watcher handle it
        // Success notification handled by caller
      } else if (update.status === 'error') {
        // Remove from pending on error
        setPendingEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(saveName);
          return newSet;
        });
        throw new Error(`Redeem failed: ${JSON.stringify(update.data)}`);
      }
    },
    offerId,
    { saveResult: { name: saveName, overwrite: replace } }
  );

  // Mark as pending immediately
  setPendingEntries(prev => new Set([...prev, saveName]));
};
