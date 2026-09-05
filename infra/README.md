# Infrastructure

Provisioned with the Azure Developer CLI. `main.bicep` creates the resource group `inlet` in the chosen region with a Log Analytics workspace, a container registry, a storage account whose file share holds the relayer's SQLite database, a Container Apps environment, the relayer container app with one always on replica, and a Static Web App for the playground.

```
azd auth login
azd env new inlet
azd env set AZURE_LOCATION westeurope
azd env set RELAYER_PRIVATE_KEY <key>
azd up
```

The playground is exported with `pnpm --filter @inletkit/playground build` and uploaded to the Static Web App with the SWA CLI using the site's deployment token.
