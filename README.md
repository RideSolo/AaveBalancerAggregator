# Aave Balancer Aggregator

## Description

The developed [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) contract automatically compute weighted average ether value of the Balancer pool token following the balance of the tokens listed in the pool. Please note that the same formula is used in [exitPool](https://github.com/balancer-labs/balancer-core/blob/f4ed5d65362a8d6cec21662fb6eae233b0babc1f/contracts/BPool.sol#L392) to compute the exit value for each token listed in the balancer pool. 

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

## Important Implemented Code

- [BalancerAggregator](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/contracts/BalancerAggregator.sol) 
- [balancer.aggregator.test.js](https://github.com/RideSolo/AaveBalancerAggregator/blob/master/test/balancer.aggregator.test.js) 