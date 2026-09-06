export const testnetDeployments = {
  "arcTestnet": {
    "inletHub": "0x84f3433550d1B6FB7f0BE197eA9faA256962408B"
  },
  "arbitrumSepolia": {
    "inletReceiver": "0x84f3433550d1B6FB7f0BE197eA9faA256962408B",
    "erc4626Adapter": "0x912c690f95a381e72F63a378fd906C6294412Fc9",
    "demoVault": "0x55da7c3B5e99816A7a9cD9dc47e24bfd7B19D6ED",
    "aaveV3Adapter": "0x9eD3b40bFd249Eb133Ae10b0006afae5d5947736"
  },
  "adapters": {
    "erc4626:v1": "keccak256 of the string erc4626:v1",
    "aave-v3:v1": "keccak256 of the string aave-v3:v1"
  }
} as const;
