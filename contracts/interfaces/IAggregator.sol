pragma solidity >=0.5.0;

interface IAggregator {
  function latestAnswer() external view returns (int256);
  // function latestTimestamp() external returns (uint256);
}
