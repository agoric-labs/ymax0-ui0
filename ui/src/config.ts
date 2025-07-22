import type { Environment, EndpointConfig } from './types';

export const ENVIRONMENT_CONFIGS: Record<Environment, EndpointConfig> = {
  devnet: {
    RPC: 'https://devnet.rpc.agoric.net',
    API: 'https://devnet.api.agoric.net',
    NETWORK_CONFIG: 'https://devnet.agoric.net/network-config',
  },
  localhost: {
    RPC: 'http://localhost:26657',
    API: 'http://localhost:1317',
    NETWORK_CONFIG: 'https://local.agoric.net/network-config',
  },
};

export const getInitialEnvironment = (): Environment => {
  const savedEnvironment = localStorage.getItem('agoricEnvironment');
  return (savedEnvironment as Environment) || 'devnet';
};

/**
 * Configure endpoints based on environment and codespace settings
 */
export const configureEndpoints = (environment: Environment) => {
  const endpoints = { ...ENVIRONMENT_CONFIGS[environment] };

  const codeSpaceHostName = import.meta.env.VITE_HOSTNAME;
  const codeSpaceDomain = import.meta.env
    .VITE_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  // Only override with codespace endpoints if explicitly configured
  if (codeSpaceHostName && codeSpaceDomain) {
    endpoints.API = `https://${codeSpaceHostName}-1317.${codeSpaceDomain}`;
    endpoints.RPC = `https://${codeSpaceHostName}-26657.${codeSpaceDomain}`;
    console.log('Using codespace endpoints:', endpoints);
  } else {
    console.log(`Using ${environment} endpoints:`, endpoints);
  }

  return endpoints;
};
