import { describe, it, expect, vi } from 'vitest';

describe('TransactionHistory completion status matching', () => {
  // Mock marshaller that simulates the actual behavior
  const mockMarshaller = {
    fromCapData: (capData: any) => {
      const body = capData.body;
      if (typeof body === 'string' && body.startsWith('#')) {
        return JSON.parse(body.substring(1));
      }
      return JSON.parse(body);
    }
  };

  const readFullyResults = [
    "{\"body\":\"#{\\\"id\\\":1755623961747,\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}",
    "{\"body\":\"#{\\\"id\\\":1755623961747,\\\"result\\\":{\\\"passStyle\\\":\\\"undefined\\\"},\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}",
    "{\"body\":\"#{\\\"id\\\":1755583523224,\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}",
    "{\"body\":\"#{\\\"id\\\":1755583523224,\\\"result\\\":{\\\"passStyle\\\":\\\"undefined\\\"},\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}",
    "{\"body\":\"#{\\\"id\\\":1755560076916,\\\"updated\\\":\\\"invocation\\\"}\",\"slots\":[]}"
  ];

  const actionCapData = {
    "body": "#{\"message\":{\"args\":[\"agoric17gwes9e636p4qthvmdrgk3ne2rdwwaaw86qmd8\",\"$0.Alleged: InstanceHandle#board038413\"],\"id\":1755623961747,\"method\":\"deliverPlannerInvitation\",\"saveResult\":\"#undefined\",\"targetName\":\"creatorFacet\"},\"method\":\"invokeEntry\"}",
    "slots": [
      "board038413"
    ]
  };

  it('should deserialize wallet updates correctly', () => {
    const deserializedUpdates = readFullyResults.map((updateString) => {
      const capData = JSON.parse(updateString);
      return mockMarshaller.fromCapData(capData);
    });

    expect(deserializedUpdates).toHaveLength(5);
    expect(deserializedUpdates[0]).toEqual({
      id: 1755623961747,
      updated: 'invocation'
    });
    expect(deserializedUpdates[1]).toEqual({
      id: 1755623961747,
      result: { passStyle: 'undefined' },
      updated: 'invocation'
    });
  });

  it('should extract invocation ID from action capData correctly', () => {
    const action = mockMarshaller.fromCapData(actionCapData);
    
    expect(action.method).toBe('invokeEntry');
    expect(action.message.id).toBe(1755623961747);
    expect(typeof action.message.id).toBe('number');
  });

  it('should find matching completion status', () => {
    // Deserialize wallet updates
    const deserializedUpdates = readFullyResults.map((updateString) => {
      const capData = JSON.parse(updateString);
      return mockMarshaller.fromCapData(capData);
    });

    // Extract invocation ID from action
    const action = mockMarshaller.fromCapData(actionCapData);
    const invocationId = action.message.id;

    // Find completion update
    const completionUpdate = deserializedUpdates.find((update: any) => 
      update.updated === 'invocation' && 
      update.id === invocationId
    );

    expect(completionUpdate).toBeDefined();
    expect(completionUpdate.id).toBe(1755623961747);
    expect(typeof completionUpdate.id).toBe('number');
    expect(typeof invocationId).toBe('number');
    expect(completionUpdate.id === invocationId).toBe(true);
  });

  it('should determine completion status correctly', () => {
    // Deserialize wallet updates
    const deserializedUpdates = readFullyResults.map((updateString) => {
      const capData = JSON.parse(updateString);
      return mockMarshaller.fromCapData(capData);
    });

    // Extract invocation ID from action
    const action = mockMarshaller.fromCapData(actionCapData);
    const invocationId = action.message.id;

    // Find completion update with result
    const completionUpdate = deserializedUpdates.find((update: any) => 
      update.updated === 'invocation' && 
      update.id === invocationId &&
      update.result !== undefined
    );

    expect(completionUpdate).toBeDefined();
    expect(completionUpdate.error).toBeUndefined();
    expect(completionUpdate.result).toEqual({ passStyle: 'undefined' });
    
    // Should be 'completed' since there's a result and no error
    const status = completionUpdate.error ? 'failed' : 'completed';
    expect(status).toBe('completed');
  });

  it('should handle type consistency between IDs', () => {
    // This test specifically checks the type issue
    const walletUpdateId = 1755623961747; // number from wallet update
    const actionId = 1755623961747; // number from action
    
    expect(typeof walletUpdateId).toBe('number');
    expect(typeof actionId).toBe('number');
    expect(walletUpdateId === actionId).toBe(true);
    
    // Test string vs number comparison (should fail)
    const stringId = "1755623961747";
    expect(walletUpdateId === stringId).toBe(false);
    expect(walletUpdateId == stringId).toBe(true); // loose equality works
  });

  it('should extract result passStyle and return completion object', () => {
    // Simulate the getCompletionStatus function behavior
    const deserializedUpdates = readFullyResults.map((updateString) => {
      const capData = JSON.parse(updateString);
      return mockMarshaller.fromCapData(capData);
    });

    const invocationId = 1755623961747;
    
    const completionUpdate = deserializedUpdates.find((update: any) => 
      update.updated === 'invocation' && 
      update.id === invocationId
    );

    expect(completionUpdate).toBeDefined();
    
    const status = completionUpdate.error ? 'failed' : 'completed';
    const result = { status, result: completionUpdate.result };
    
    expect(result.status).toBe('completed');
    expect(result.result).toEqual({ passStyle: 'undefined' });
  });

  it('should test CompletionStatus component logic', () => {
    // Test the logic that would be used in CompletionStatus component
    const testResult = { passStyle: 'undefined' };
    
    const parts = [];
    if (testResult.passStyle) {
      parts.push(`${testResult.passStyle}`);
    }
    if (testResult.name) {
      parts.push(`"${testResult.name}"`);
    }
    
    expect(parts).toEqual(['undefined']);
    expect(parts.length > 0).toBe(true);
    expect(parts.join(' ')).toBe('undefined');
  });

  it('should test CompletionStatus with name and passStyle', () => {
    // Test with both name and passStyle
    const testResult = { passStyle: 'remotable', name: 'myFacet' };
    
    const parts = [];
    if (testResult.passStyle) {
      parts.push(`${testResult.passStyle}`);
    }
    if (testResult.name) {
      parts.push(`"${testResult.name}"`);
    }
    
    expect(parts).toEqual(['remotable', '"myFacet"']);
    expect(parts.join(' ')).toBe('remotable "myFacet"');
  });
});
