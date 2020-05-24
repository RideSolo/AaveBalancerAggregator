# Aave Balancer Aggregator

## Description

The developed [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) contract automatically compute the average weighted of the Balancer pool token following the balance of the tokens listed in the pool. Please note that the same formula is used in [exitPool](https://github.com/balancer-labs/balancer-core/blob/f4ed5d65362a8d6cec21662fb6eae233b0babc1f/contracts/BPool.sol#L392) to compute the exit value for each token listed in the balancer pool.

BalancerAggregator contract has to be used as a source for the pool token when setting up the ChainlinkProxyPriceProvider, the required chainlink feed sources must be set in BalancerAggregator. Any ether pegged token with a 1:1 ratio has to be specified in BalancerAggregator.

The implemented [test](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/test/balancer.aggregator.test.js) shows the different deployment steps, the error cases and fallback cases to Aave price oracle manged by the governance. 

```
-----------------------------                   --------------------  /== latestAnswer ==> ChainLinkAggregator 1
|ChainlinkProxyPriceProvider|== latestAnswer ==>|BalancerAggregator|==|== latestAnswer ==> ChainLinkAggregator 2
-----------------------------                   --------------------  \== latestAnswer ==> ChainLinkAggregator 3
```

## Setup

### Dependencies

* node v10.20.1
* npm 6.14.4
* truffle

### Installation

```console
$ git clone https://github.com/ridesolo/AaveBalancerAggregator.git
$ cd cd AaveBalancerAggregator
$ git submodule update --init
$ npm install
```
### Verification

```console
$ npm run compile
$ npm run test 
```

## Important Code

- [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) contract.
- [balancer.aggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/test/balancer.aggregator.test.js) tests.