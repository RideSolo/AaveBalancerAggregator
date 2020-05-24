 pragma solidity >=0.5.0;

 interface IBalancerAggregator {
    function getBalancerPool() external view returns (address);
    function getBalancerPoolTokens() external view returns(address[] memory);
}