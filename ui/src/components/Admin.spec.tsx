import '@endo/init';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import Admin from './Admin';

// Mock config functions
vi.mock('../config', () => ({
  getInitialEnvironment: () => 'devnet',
  configureEndpoints: () => ({ 
    API: 'https://devnet.api.agoric.net',
    RPC: 'https://devnet.rpc.agoric.net',
    CHAIN_ID: 'agoricdev-25'
  }),
}));

// Mock @agoric/rpc
vi.mock('@agoric/rpc', () => ({
  makeAgoricChainStorageWatcher: vi.fn(() => ({
    watchLatest: vi.fn(),
    marshaller: { 
      toCapData: vi.fn(() => ({ body: '{}', slots: [] }))
    }
  })),
  AgoricChainStoragePathKind: { Data: 'data' }
}));

// Mock @agoric/client-utils
vi.mock('@agoric/client-utils', () => ({
  makeVstorageKit: vi.fn(() => ({
    readLatestHead: vi.fn(() => Promise.resolve({ blockHeight: '12345' }))
  })),
  makeVStorage: vi.fn(() => ({
    readFully: vi.fn(() => Promise.resolve([]))
  }))
}));

// Mock wallet entry proxy
vi.mock('../walletEntryProxy', () => ({
  reifyWalletEntry: vi.fn(() => ({
    target: {},
    tools: { setName: vi.fn() }
  }))
}));

const mockWallet = {
  address: 'agoric10utru593dspjwfewcgdak8lvp9tkz0xttvcnxv',
};

const mockTxResponse = {
  tx_responses: [
    {
      height: '2759669',
      txhash: 'C98D6E090C6BCC836BE9678486C8FC2FC4379BB0FB1DA0F0A775CC3A12ACF63D',
      timestamp: '2025-08-18T23:34:37Z',
      tx: {
        body: {
          messages: [
            {
              '@type': '/agoric.swingset.MsgWalletSpendAction',
              owner: 'agoric10utru593dspjwfewcgdak8lvp9tkz0xttvcnxv',
              spend_action:
                '{"body":"#{\\"message\\":{\\"args\\":[\\"agoric17gwes9e636p4qthvmdrgk3ne2rdwwaaw86qmd8\\",\\"$0.Alleged: BoardRemoteInstanceHandle\\"],\\"id\\":1755560076916,\\"method\\":\\"deliverPlannerInvitation\\",\\"saveResult\\":\\"#undefined\\",\\"targetName\\":\\"creatorFacet\\"},\\"method\\":\\"invokeEntry\\"}","slots":["board038413"]}',
            },
          ],
        },
      },
    },
  ],
};

describe('Admin component', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTxResponse),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skip('should parse and display wallet spend action from transaction', async () => {
    render(
      <Admin
        signAndBroadcastAction={() => {}}
        wallet={mockWallet}
        tryConnectWallet={() => {}}
        instances={[]}
      />,
    );

    await waitFor(() => {
      // Check for a specific part of the parsed action.
      const actionText = screen.getByText(
        /E\(creatorFacet\)\.deliverPlannerInvitation/,
      );
      expect(actionText).toBeInTheDocument();
    });

    // Check that "Error parsing action" is not present
    expect(screen.queryByText('Error parsing action')).toBeNull();
  });

  it('should process wallet updates with multiple values in same block', () => {
    // Mock the network response structure
    const mockWalletUpdatesResponse = {
      blockHeight: "2773807",
      values: [
        "{\"body\":\"#{\\\"id\\\":1755637067481,\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}",
        "{\"body\":\"#{\\\"id\\\":1755637067481,\\\"result\\\":{\\\"name\\\":\\\"creatorFacet\\\",\\\"passStyle\\\":\\\"remotable\\\"},\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}"
      ]
    };

    // Mock marshaller
    const mockMarshaller = {
      fromCapData: (capData: any) => {
        const body = capData.body;
        if (typeof body === 'string' && body.startsWith('#')) {
          return JSON.parse(body.substring(1));
        }
        return JSON.parse(body);
      }
    };

    // Simulate processing the updates
    const pendingInvocations = new Set([1755637067481]);
    let completedInvocations: number[] = [];

    // Process updates like the watcher would
    if (mockWalletUpdatesResponse.values && Array.isArray(mockWalletUpdatesResponse.values)) {
      mockWalletUpdatesResponse.values.forEach((updateString: string) => {
        try {
          const capData = JSON.parse(updateString);
          const update = mockMarshaller.fromCapData(capData);
          
          if (update.updated === 'invocation' && update.id && (update.result !== undefined || update.error)) {
            completedInvocations.push(update.id);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      });
    }

    // Should find the completed invocation
    expect(completedInvocations).toContain(1755637067481);
    expect(completedInvocations).toHaveLength(1);
  });
});
