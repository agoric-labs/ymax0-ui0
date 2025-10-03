import { reifyWalletEntry } from '../walletEntryProxy';

export interface ContractServiceDependencies {
  wallet: any;
  keplr: any;
  chainId: string;
  marshaller: any;
  rpcEndpoint: string;
  instances?: Array<[string, unknown]>;
  instanceInfo?: { ymax0?: string; postalService?: string } | null;
}

export interface ContractOperationResult {
  success: boolean;
  message: string;
  invocationId?: number;
}

export class ContractService {
  constructor(private deps: ContractServiceDependencies) {}

  private validateDependencies(): void {
    const { wallet, keplr, chainId, marshaller } = this.deps;
    if (!wallet || !keplr || !chainId || !marshaller) {
      throw new Error('Wallet, Keplr, chain ID, or marshaller not available');
    }
  }

  async terminate(
    message: string,
    trackInvocation: (tools: any, method: string, targetName: string) => number
  ): Promise<ContractOperationResult> {
    this.validateDependencies();

    try {
      // Get board ID for target confirmation
      const ymax0Instance = this.deps.instanceInfo?.ymax0 
        ? this.deps.instances?.find(([n]) => n === 'ymax0')?.[1] 
        : null;
      const [boardId] = ymax0Instance 
        ? this.deps.marshaller.toCapData(ymax0Instance).slots 
        : [''];
      
      const { target, tools } = reifyWalletEntry<{ 
        terminate: (args?: { message?: string; target?: string }) => Promise<any> 
      }>({
        targetName: 'ymaxControl',
        wallet: this.deps.wallet,
        keplr: this.deps.keplr,
        chainId: this.deps.chainId,
        marshaller: this.deps.marshaller,
        rpcEndpoint: this.deps.rpcEndpoint,
      });

      const invocationId = trackInvocation(tools, 'terminate', 'ymaxControl');

      const terminateArgs: { message?: string; target?: string } = {};
      if (message.trim()) {
        terminateArgs.message = message;
      }
      if (boardId) {
        terminateArgs.target = boardId;
      }

      await target.terminate(Object.keys(terminateArgs).length > 0 ? terminateArgs : undefined);
      
      return {
        success: true,
        message: 'Terminate action submitted successfully',
        invocationId
      };
    } catch (error) {
      console.error('Terminate action failed:', error);
      return {
        success: false,
        message: `Terminate action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async upgrade(
    bundleId: string,
    trackInvocation: (tools: any, method: string, targetName: string) => number
  ): Promise<ContractOperationResult> {
    this.validateDependencies();

    if (!bundleId.trim()) {
      return {
        success: false,
        message: 'Please enter a bundle ID'
      };
    }

    try {
      const { target, tools } = reifyWalletEntry<{ 
        upgrade: (bundleId: string) => Promise<any> 
      }>({
        targetName: 'ymaxControl',
        wallet: this.deps.wallet,
        keplr: this.deps.keplr,
        chainId: this.deps.chainId,
        marshaller: this.deps.marshaller,
        rpcEndpoint: this.deps.rpcEndpoint,
      });

      const invocationId = trackInvocation(tools, 'upgrade', 'ymaxControl');

      await target.upgrade(bundleId);
      
      return {
        success: true,
        message: 'Upgrade action submitted successfully',
        invocationId
      };
    } catch (error) {
      console.error('Upgrade action failed:', error);
      return {
        success: false,
        message: `Upgrade action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async installAndStart(
    bundleId: string,
    trackInvocation: (tools: any, method: string, targetName: string) => number
  ): Promise<ContractOperationResult> {
    this.validateDependencies();

    if (!bundleId.trim()) {
      return {
        success: false,
        message: 'Please enter a bundle ID'
      };
    }

    try {
      const { target, tools } = reifyWalletEntry<{ 
        installAndStart: (args: { bundleId: string; issuers: any }) => Promise<any> 
      }>({
        targetName: 'ymaxControl',
        wallet: this.deps.wallet,
        keplr: this.deps.keplr,
        chainId: this.deps.chainId,
        marshaller: this.deps.marshaller,
        rpcEndpoint: this.deps.rpcEndpoint,
      });

      const invocationId = trackInvocation(tools, 'installAndStart', 'ymaxControl');

      // TODO: Get actual issuers from agoricNames
      const issuers = {}; // Placeholder
      await target.installAndStart({ bundleId, issuers });
      
      return {
        success: true,
        message: 'Install and start action submitted successfully',
        invocationId
      };
    } catch (error) {
      console.error('Install and start action failed:', error);
      return {
        success: false,
        message: `Install and start action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getCreatorFacet(
    facetName: string,
    trackInvocation: (tools: any, method: string, targetName: string) => number
  ): Promise<ContractOperationResult> {
    this.validateDependencies();

    if (!facetName.trim()) {
      return {
        success: false,
        message: 'Please enter a name to save the creator facet'
      };
    }

    try {
      const { target, tools } = reifyWalletEntry<{ 
        getCreatorFacet: () => Promise<any> 
      }>({
        targetName: 'ymaxControl',
        wallet: this.deps.wallet,
        keplr: this.deps.keplr,
        chainId: this.deps.chainId,
        marshaller: this.deps.marshaller,
        rpcEndpoint: this.deps.rpcEndpoint,
      });

      tools.setName(facetName, true);
      const invocationId = trackInvocation(tools, 'getCreatorFacet', 'ymaxControl');
      
      await target.getCreatorFacet();
      
      return {
        success: true,
        message: `Creator facet retrieved and saved as "${facetName}"`,
        invocationId
      };
    } catch (error) {
      console.error('Get creator facet failed:', error);
      return {
        success: false,
        message: `Get creator facet failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deliverPlannerInvitation(
    plannerAddress: string,
    trackInvocation: (tools: any, method: string, targetName: string) => number
  ): Promise<ContractOperationResult> {
    this.validateDependencies();

    if (!plannerAddress.trim()) {
      return {
        success: false,
        message: 'Please enter a planner address'
      };
    }

    try {
      const postalServiceInstance = this.deps.instanceInfo?.postalService 
        ? this.deps.instances?.find(([n]) => n === 'postalService')?.[1] 
        : null;
      
      const { target, tools } = reifyWalletEntry<{ 
        deliverPlannerInvitation: (planner: string, postalService: any) => Promise<any> 
      }>({
        targetName: 'creatorFacet',
        wallet: this.deps.wallet,
        keplr: this.deps.keplr,
        chainId: this.deps.chainId,
        marshaller: this.deps.marshaller,
        rpcEndpoint: this.deps.rpcEndpoint,
      });

      const invocationId = trackInvocation(tools, 'deliverPlannerInvitation', 'creatorFacet');

      await target.deliverPlannerInvitation(plannerAddress, postalServiceInstance);
      
      return {
        success: true,
        message: 'Planner invitation delivered successfully',
        invocationId
      };
    } catch (error) {
      console.error('Deliver planner invitation failed:', error);
      return {
        success: false,
        message: `Deliver planner invitation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
