# Aave Balancer Aggregator

## Description

The developed [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) contract automatically compute the weighted average price of a Balancer pool token following the balances of the tokens listed in the pool. Please note that the same formula is used in [exitPool](https://github.com/balancer-labs/balancer-core/blob/f4ed5d65362a8d6cec21662fb6eae233b0babc1f/contracts/BPool.sol#L392) to compute the exit value for each token listed in the balancer pool.

BalancerAggregator contract has to be used as a source for the pool token when setting up the ChainlinkProxyPriceProvider, the required chainlink feed sources must be set in BalancerAggregator.

```
-----------------------------                                    --------------------           /== latestAnswer ==> ChainLinkAggregator 1   
|ChainlinkProxyPriceProvider|==== latestAnswer =================>|BalancerAggregator|===========|== latestAnswer ==> ChainLinkAggregator 2   
-----------------------------                                    --------------------           \== latestAnswer ==> ChainLinkAggregator 3   
			||                     -------------                   ||
			=== getAssetPrice == > |PriceOracle| <== getAssetPrice===
                                               -------------
```

The implemented contract act as a middle aggregator between Aave and ChainLink feeds. BalancerAggregator uses the fallback price oracle managed by the Aave to get the token prices if the ChainLinks feeds return zero. 

If a chainlink feed returns zero and the Aave managed price oracle returns zero for the same asset the BalancerAggregator for a specific balancer pool will return zero, even if all other tokens are set correctly. In the previous case ChainlinkProxyPriceProvider has to fallback to the managed price oracle to get the price of the pool token.

The implemented [test](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/test/balancer.aggregator.test.js) shows the different deployment steps, the error cases and fallback cases to Aave price oracle. 

## Setup

### Dependencies

* node v10.20.1
* npm 6.14.4
* truffle

### Installation

```console
$ git clone https://github.com/ridesolo/AaveBalancerAggregator.git
$ cd AaveBalancerAggregator
$ git submodule update --init
$ npm install
```
### Verification

```console
$ npm run compile
$ npm run test 
```

### Coverage Test

```console
$ npm run test-coverage
```

## Important Code

- [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) contract.
- [balancer.aggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/test/balancer.aggregator.test.js) tests.
