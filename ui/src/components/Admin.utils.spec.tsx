import { describe, it, expect } from 'vitest';
import { formatActionColumn } from './Admin.utils.tsx';
import React from 'react';

const mockInvokeEntryMessage = {
  '@type': '/agoric.swingset.MsgWalletSpendAction',
  owner: 'agoric10utru593dspjwfewcgdak8lvp9tkz0xttvcnxv',
  spend_action:
    '{"body":"#{\\"message\\":{\\"args\\":[\\"agoric17gwes9e636p4qthvmdrgk3ne2rdwwaaw86qmd8\\",\\"$0.Alleged: BoardRemoteInstanceHandle\\"],\\"id\\":1755560076916,\\"method\\":\\"deliverPlannerInvitation\\",\\"saveResult\\":\\"#undefined\\",\\"targetName\\":\\"creatorFacet\\"},\\"method\\":\\"invokeEntry\\"}","slots":["board038413"]}',
};

const mockExecuteOfferMessage = {
  '@type': '/agoric.swingset.MsgWalletSpendAction',
  owner: 'agoric1...',
  spend_action: JSON.stringify({
    body: `#${JSON.stringify({
      method: 'executeOffer',
      offer: {
        id: 'open-2025-08-18T23:18:27.921Z',
        invitationSpec: {
          callPipe: [['makeOpenPortfolioInvitation']],
          instancePath: ['ymax0'],
          source: 'agoricContract',
        },
        offerArgs: {
          flow: [],
        },
        proposal: {
          give: {
            Access: {
              brand: '$0.Alleged: BoardRemotePoC26 brand',
              value: '+1',
            },
          },
        },
      },
    })}`,
    slots: ['board0257'],
  }),
};

describe('Admin utils', () => {
  describe('formatActionColumn', () => {
    it('should format invokeEntry action', () => {
      const { actionDisplay, actionToCopy } = formatActionColumn(
        mockInvokeEntryMessage,
      );
      const capData = JSON.parse(actionToCopy);
      const bridgeAction = JSON.parse(capData.body.substring(1));
      expect(bridgeAction.method).toBe('invokeEntry');
      const display = actionDisplay as React.ReactElement;
      expect(display.props.title).toBe('ID: 1755560076916');
      expect(display.props.children).toBe(
        'E(creatorFacet).deliverPlannerInvitation(\n  "agoric17gwes9e636p4qthvmdrgk3ne2rdwwaaw86qmd8",\n  getValue("board038413")\n)',
      );
    });

    it('should format executeOffer action', () => {
      const { actionDisplay, actionToCopy } = formatActionColumn(
        mockExecuteOfferMessage,
      );
      const capData = JSON.parse(actionToCopy);
      const bridgeAction = JSON.parse(capData.body.substring(1));
      expect(bridgeAction.method).toBe('executeOffer');
      const display = actionDisplay as React.ReactElement;
      expect(display.props.title).toBe('ID: open-2025-08-18T23:18:27.921Z');
      expect(display.props.children).toBe(
        'E(zoe).offer(\n  E(instance.ymax0).makeOpenPortfolioInvitation(),\n  { give: { Access: ... } },\n  {"flow":[]}\n)',
      );
    });

    it('should return N/A for unknown message', () => {
      const { actionDisplay } = formatActionColumn({
        '@type': '/cosmos.bank.v1beta1.MsgSend',
      });
      expect(actionDisplay).toBe('N/A');
    });
  });
});
