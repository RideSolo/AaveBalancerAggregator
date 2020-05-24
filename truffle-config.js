
const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

options = {
  contracts_directory: "./{aave/contracts,balancer/contracts,contracts}/**/*.sol",
  plugins: [
    "truffle-plugin-verify"
  ],
  api_keys: {
      etherscan: process.env.ETHERSCAN_API_KEY
  },

  networks: {
    kovan: {
      provider: () => new HDWalletProvider(
        process.env.KOVAN_MNEMONIC,
        process.env.KOVAN_PROVIDER_URL,
        0, 10, true 
      ),
      network_id: 42, // Kovan's id
      gasPrice: 1000000000, 
      timeoutBlocks: 50, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true // Skip dry run before migrations? (default: false for public nets )
    },
    mainnet: {
      provider: () => new HDWalletProvider(
        process.env.MAINNET_MNEMONIC,
        process.env.MAINNET_PROVIDER_URL,
        0, 10, true // shareNonce
      ),
      network_id: 1, // mainnet's id
      gasPrice: process.env.MAINNET_GAS_PRICE || 1000*1000*1000, // default 1 gwei
      timeoutBlocks: 50, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: false // Skip dry run before migrations? (default: false for public nets )
    },
  },
  compilers: {
    solc: {
      version: "0.5.12",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
}

let reporterArg = process.argv.indexOf('--report');

if (reporterArg !== -1) {
  options['mocha'] = {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      excludeContracts: ['Migrations'],
      url: httpProviderAddress
    }
  }
}

module.exports = options;
