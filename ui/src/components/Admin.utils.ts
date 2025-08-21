import React from 'react';

export const formatActionColumn = (message: any) => {
  let actionDisplay: React.ReactNode = 'N/A';
  let actionToCopy = '';

  if (!message) {
    return { actionDisplay, actionToCopy };
  }

  const messageType = message?.['@type'] || 'N/A';
  let actionString;
  if (messageType === '/agoric.swingset.MsgWalletSpendAction') {
    actionString = message.spend_action;
  } else if (messageType === '/agoric.swingset.MsgWalletAction') {
    actionString = message.action;
  }

  if (actionString) {
    try {
      const capData = JSON.parse(actionString);
      actionToCopy = JSON.stringify(capData, null, 2);

      let { body } = capData;
      if (typeof body === 'string' && body.startsWith('#')) {
        body = body.substring(1);
      }
      const bridgeAction = JSON.parse(body);

      if (bridgeAction.method === 'invokeEntry' && bridgeAction.message) {
        const { targetName, method, args, id } = bridgeAction.message;

        const formattedArgs = args.map((arg: any) => {
          if (typeof arg === 'string' && arg.startsWith('$')) {
            const match = arg.match(/^\$(\d+)/);
            if (match) {
              const slotIndex = parseInt(match[1], 10);
              if (capData.slots && slotIndex < capData.slots.length) {
                const slotValue = capData.slots[slotIndex];
                return `getValue("${slotValue}")`;
              }
            }
          }
          return JSON.stringify(arg);
        });

        const displayString = `E(${targetName}).${method}(${formattedArgs.join(
          ', ',
        )})`;

        actionDisplay = (
          <pre
            title={`ID: ${id}`}
            style={{ margin: 0, fontSize: 'inherit' }}
          >
            {displayString}
          </pre>
        );
      } else if (
        bridgeAction.method === 'executeOffer' &&
        bridgeAction.offer
      ) {
        const { offer } = bridgeAction;
        const { invitationSpec, proposal, offerArgs, id } = offer;

        let invitationString = '...';
        if (
          invitationSpec.source === 'agoricContract' &&
          invitationSpec.instancePath &&
          invitationSpec.callPipe
        ) {
          const instance = `instance.${invitationSpec.instancePath.join('.')}`;
          const call = invitationSpec.callPipe[0][0];
          invitationString = `E(${instance}).${call}()`;
        }

        const formatProposalPart = (part: object) => {
          if (!part) return '{}';
          const keys = Object.keys(part);
          if (keys.length === 0) return '{}';
          return `{ ${keys.join(', ')}: ... }`;
        };

        const formatProposal = (p: any) => {
          if (!p) return '{}';
          const parts = [];
          if (p.give) {
            parts.push(`give: ${formatProposalPart(p.give)}`);
          }
          if (p.want) {
            parts.push(`want: ${formatProposalPart(p.want)}`);
          }
          return `{ ${parts.join(', ')} }`;
        };

        const proposalString = formatProposal(proposal);
        const offerArgsString = JSON.stringify(offerArgs);

        const displayString = `E(zoe).offer(\n  ${invitationString},\n  ${proposalString},\n  ${offerArgsString}\n)`;

        actionDisplay = (
          <pre
            title={`ID: ${id}`}
            style={{ margin: 0, fontSize: 'inherit' }}
          >
            {displayString}
          </pre>
        );
      } else {
        // Fallback for other action types
        actionDisplay = (
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: 'inherit',
            }}
          >
            {JSON.stringify(bridgeAction, null, 2)}
          </pre>
        );
      }
    } catch (e) {
      console.error('Error parsing wallet action:', e);
      actionDisplay = 'Error parsing action';
    }
  }

  return { actionDisplay, actionToCopy };
};
