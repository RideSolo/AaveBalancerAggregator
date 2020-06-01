
pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


import "./aave/contracts/interfaces/IPriceOracleGetter.sol";
import "./aave/contracts/interfaces/IChainlinkAggregator.sol";
import "./aave/contracts/libraries/EthAddressLib.sol";
// import "../aave/contracts/libraries/WadRayMath.sol";

import "./interfaces/IBPool.sol";
import "./interfaces/IAggregator.sol";
import "./interfaces/IBalancerAggregator.sol";

interface IERC20 {
    function decimals() external view returns (uint8);
}

contract BalancerAggregator is IAggregator, IBalancerAggregator, Ownable{

    address public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    mapping(address => bool) public IS_ETH;

    using SafeMath for uint256;
    // using WadRayMath for uint256;
    
    address public bpoolAddress;
    IBPool public bpool;

    address[] public balancerPoolTokens;
    mapping(address => uint256) balancerPoolTokensDecimals;

    event AssetSourceUpdated(address indexed asset, address indexed source);
    event FallbackOracleUpdated(address indexed fallbackOracle);

    mapping(address => IChainlinkAggregator) private assetsSources;
    IPriceOracleGetter private fallbackOracle;

    // --------------------------------------------------------------------------------------------------//
    // checkAssets modfier verify if all tokens listed in the balancer pool are listed in _assets array
    //---------------------------------------------------------------------------------------------------//

    modifier checkAssets(
        address _bpoolAddress, 
        address[] memory _assets) 
    {

        IBPool m_bpool = IBPool(_bpoolAddress);

        // ---------------------------------------------------------------------------------------------- //
        // Only finilized pool can be used as collateral, if the pool is not finalized the
        // the pool owner risk to make changes to the weights and unbalance the aave users liquidation ratios.
        // this verification must be added to the LendingPoolConfigurator when initializing the reserve
        // in "initReserve"
        // https://docs.balancer.finance/smart-contracts/api#isfinalized
        // ----------------------------------------------------------------------------------------------- //

        require(m_bpool.isFinalized(),"checkAssets: The balancer pool is not finalized");

        address[] memory listedTokens = m_bpool.getFinalTokens();

        uint256 counter = 0;
        for(uint256 i=0;i<listedTokens.length;i++) {
            for(uint256 j=0;j<_assets.length;j++) {
                if(listedTokens[i] == _assets[j]) {
                    counter++;
                    break;
                }
            }
        }
        require(counter == listedTokens.length,"checkAssets: One or more listed tokens in the balancer pool are not present in assets");
        _;
    }

    //----------------------------------------------------------------------------------------------//
    // - The assets and ChainlinkAggregator sources added through the constructor or setAssetSources 
    // must be the listed tokens in the balancer liquidity pool not the liquidity pool token itself.
    // - If an asset is pegged by 1:1 ratio with ethereum, the chainlink aggregator source address must 
    // be set to address (0x0), the same asset must be specified to be a ETH or Wrapped eth by adding it
    // to _etherTokens array.
    //----------------------------------------------------------------------------------------------//

    constructor(
        address _bpoolAddress, 
        address[] memory _assets, 
        address[] memory _sources,
        address[] memory _etherTokens, 
        address _fallbackOracle) 
    checkAssets(_bpoolAddress,_assets)
    public {

        internalSetFallbackOracle(_fallbackOracle);
        internalSetAssetsSources(_assets, _sources);
        internalSetBalancerPooltokens(_bpoolAddress);
        internalSetEtherTokens(_etherTokens);

        bpoolAddress = _bpoolAddress;
        bpool = IBPool(_bpoolAddress);

        IS_ETH[WETH] = true;
        IS_ETH[ETH_ADDRESS] = true;
    }


    // --------------------------------------------------------------------------------------------- //
    // please note that in this implementation all assets listed on the balancer pool has to be reset,
    // even if the aggregator address didn't not change, otherwise the function will throw, since 
    // checkAssets modifier is used. If a token is an ether pegged token its chainlink aggregator address
    // or source address can be set to zero
    // --------------------------------------------------------------------------------------------- //

    /// @notice External function called by the Aave governance to set or replace sources of assets
    /// @param _assets The addresses of the assets
    /// @param _sources The address of the source of each asset

    function setAssetSources(address[] calldata _assets, address[] calldata _sources) 
        onlyOwner
        checkAssets(bpoolAddress,_assets)
        external 
    {
        internalSetAssetsSources(_assets, _sources);
    }

    /// @notice Sets the fallbackOracle
    /// - Callable only by the Aave governance
    /// @param _fallbackOracle The address of the fallbackOracle
    function setFallbackOracle(address _fallbackOracle) external onlyOwner {
        internalSetFallbackOracle(_fallbackOracle);
    }

    /// @notice Sets the tokens to true or not if their value is pegged with a 1:1 ratio with ether
    /// if WETH and ETH_ADDRESS are already set in the contructor, this function is implemented in
    /// case if a balancer pool contains a different token wrapper for ethereum.
    /// - Callable only by the Aave governance
    /// @param _token The token address
    /// @param _isEth equal to true if the token is pegged with 1:1 ratio with ether, otherwise false
    function setEtherToken(address _token, bool _isEth) onlyOwner external {
        require(_token != address(0x0),"setEtherToken: Incorrect token address");
        require(bpool.isBound(_token),"setEtherToken: Token is not bound to the balancer pool");
        IS_ETH[_token] = _isEth;
    }

    /// @notice Internal function to set the sources for each asset
    /// @param _assets The addresses of the assets
    /// @param _sources The address of the source of each asset
    function internalSetAssetsSources(address[] memory _assets, address[] memory _sources) internal {
        require(_assets.length == _sources.length, "INCONSISTENT_PARAMS_LENGTH");
        for (uint256 i = 0; i < _assets.length; i++) {
            assetsSources[_assets[i]] = IChainlinkAggregator(_sources[i]);
            emit AssetSourceUpdated(_assets[i], _sources[i]);
        }
    }

    /// @notice Internal function to set the fallbackOracle
    /// @param _fallbackOracle The address of the fallbackOracle
    function internalSetFallbackOracle(address _fallbackOracle) internal {
        require(_fallbackOracle != address(0x0),"internalSetFallbackOracle: Incorrect address");
        fallbackOracle = IPriceOracleGetter(_fallbackOracle);
        emit FallbackOracleUpdated(_fallbackOracle);
    }

    /// @notice Internal function to set the balancer pool tokens
    /// @param _bpoolAddress The address of the balancer pool
    function internalSetBalancerPooltokens(address _bpoolAddress) internal {
        IBPool m_bpool = IBPool(_bpoolAddress);
        address[] memory tokens = m_bpool.getFinalTokens();
        for(uint256 i=0;i<tokens.length;i++) {
            balancerPoolTokens.push(tokens[i]);
            balancerPoolTokensDecimals[tokens[i]] = uint256(IERC20(tokens[i]).decimals());
        }
    }

    /// @notice Internal function to set the tokens pegged 1:1 ratio with ether
    /// @param _etherTokens ethereum pegged tokens list
    function internalSetEtherTokens(address[] memory _etherTokens) internal {
        for(uint256 i=0; i<_etherTokens.length; i++) {
            address _token = _etherTokens[i];
            require(_token != address(0x0),"internalSetEtherTokens: Incorrect token address");
            IS_ETH[_token] = true;
        }
    }

    /// @notice check if a token address is listed inside the contract as an ether token
    /// @param _token address to be checked
    function isEth(address _token) public view returns(bool) {
        return IS_ETH[_token];
    }

    function getBalancerPool() external view returns (address) {
        return bpoolAddress;
    }

    function getBalancerPoolTokens() external view returns(address[] memory) {
        return bpool.getFinalTokens();
    }

    function getFallBackOracle() external view returns(address) {
        return address(fallbackOracle);
    }

    function latestAnswer() external view returns (int256) {

        uint256 _tokenListlength = balancerPoolTokens.length;
        uint256 _totalSupply = bpool.totalSupply();

        uint256 _bpoolMultiplier = 10**uint256(bpool.decimals());

        address _token;
        uint256 _unsignedPrice;
        uint256 _bal;
        uint256 _etherValue = 0;
        uint256 _tokenMultiplier;

        for(uint256 i=0; i<_tokenListlength; i++)
        {   
            _token = balancerPoolTokens[i];
            _tokenMultiplier = 10 ** uint256(balancerPoolTokensDecimals[_token]);

            int256 _price = isEth(_token) ? 1 ether : assetsSources[_token].latestAnswer();
            _unsignedPrice = (_price > 0) ? uint256(_price) : fallbackOracle.getAssetPrice(_token);
            
            // if _unsignedPrice of any listed token in a pool is equal to zero latestAnswer() must 
            // return zero, so ChainlinkProxyPriceProvider can fall back to to the value of the balancer
            // pool token set by Aave governance.

            if(_unsignedPrice == 0) return int256(0);

            _bal = bpool.getBalance(_token);
            _etherValue = _etherValue.add(_bal.mul(_bpoolMultiplier).mul(_unsignedPrice).div(_tokenMultiplier));
        }

        return int256(_etherValue.div(_totalSupply));
    }
}

