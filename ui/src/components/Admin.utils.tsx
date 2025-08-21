import React from 'react';

export const extractSaveResultName = (message: any): string | null => {
  if (!message) return null;

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
      let { body } = capData;
      if (typeof body === 'string' && body.startsWith('#')) {
        body = body.substring(1);
      }
      const bridgeAction = JSON.parse(body);

      if (bridgeAction.method === 'executeOffer' && bridgeAction.offer) {
        const { offer } = bridgeAction;
        return offer.saveResult?.name || null;
      } else if (bridgeAction.method === 'invokeEntry' && bridgeAction.message) {
        const { message: invokeMessage } = bridgeAction;
        return invokeMessage.saveResult?.name || null;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return null;
};

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
        const { targetName, method, args, id, saveResult } = bridgeAction.message;

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

        let displayString;
        if (saveResult && saveResult.name) {
          displayString = `${saveResult.name} = await E(${targetName}).${method}(\n  ${formattedArgs.join(
            ',\n  ',
          )}\n)`;
        } else {
          displayString = `E(${targetName}).${method}(\n  ${formattedArgs.join(
            ',\n  ',
          )}\n)`;
        }

        actionDisplay = (
          <pre
            title={`ID: ${id}`}
            style={{
              margin: 0,
              fontSize: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
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
        } else if (
          invitationSpec.source === 'purse' &&
          invitationSpec.instance &&
          invitationSpec.description
        ) {
          // Handle slot reference in instance
          let instanceValue = invitationSpec.instance;
          if (typeof instanceValue === 'string' && instanceValue.startsWith('$')) {
            const match = instanceValue.match(/^\$(\d+)/);
            if (match) {
              const slotIndex = parseInt(match[1], 10);
              if (capData.slots && slotIndex < capData.slots.length) {
                const slotValue = capData.slots[slotIndex];
                instanceValue = `getValue("${slotValue}")`;
              }
            }
          }
          
          invitationString = `invitationPurse.withdraw({\n    instance: ${instanceValue},\n    description: "${invitationSpec.description}"\n  })`;
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

        let displayString;
        if (offer.saveResult && offer.saveResult.name) {
          displayString = `${offer.saveResult.name} = await E(E(zoe).offer(\n  ${invitationString},\n  ${proposalString},\n  ${offerArgsString}\n)).getOfferResult()`;
        } else {
          displayString = `E(zoe).offer(\n  ${invitationString},\n  ${proposalString},\n  ${offerArgsString}\n)`;
        }

        actionDisplay = (
          <pre
            title={`ID: ${id}`}
            style={{
              margin: 0,
              fontSize: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
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
