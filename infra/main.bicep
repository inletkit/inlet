targetScope = 'subscription'

@description('Name of the azd environment.')
param environmentName string

@description('Azure region for every resource.')
param location string

@description('Resource group name.')
param resourceGroupName string = 'inlet'

@secure()
@description('Private key the relayer signs with.')
param relayerPrivateKey string

param arcRpc string = 'https://rpc.testnet.arc.io'
param baseSepoliaRpc string = 'https://sepolia.base.org'
param arbitrumSepoliaRpc string = 'https://sepolia-rollup.arbitrum.io/rpc'
param corsOrigin string = '*'

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: { 'azd-env-name': environmentName }
}

module resources './resources.bicep' = {
  name: 'resources'
  scope: group
  params: {
    location: location
    environmentName: environmentName
    relayerPrivateKey: relayerPrivateKey
    arcRpc: arcRpc
    baseSepoliaRpc: baseSepoliaRpc
    arbitrumSepoliaRpc: arbitrumSepoliaRpc
    corsOrigin: corsOrigin
  }
}

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryLoginServer
output RELAYER_URL string = resources.outputs.relayerUrl
output PLAYGROUND_HOSTNAME string = resources.outputs.playgroundHostname
output AZURE_RESOURCE_GROUP string = group.name
