


const PriceOracle = artifacts.require("PriceOracle");
const BalancerAggregator = artifacts.require("BalancerAggregator");
const ChainlinkProxyPriceProvider = artifacts.require("ChainlinkProxyPriceProvider");
const MockAggregatorBAT = artifacts.require("MockAggregatorBAT");
const MockAggregatorDAI = artifacts.require("MockAggregatorDAI");

const BFactory = artifacts.require("BFactory");
const BPool = artifacts.require("BPool");
const TToken = artifacts.require("TToken");

const chai = require('chai');
const BigNumber = require("bignumber.js");

const {
  BN, 
  constants,
  time,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');

contract('converter', (accounts) => {

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const { toWei } = web3.utils;
  const { fromWei } = web3.utils;
  const { hexToUtf8 } = web3.utils;

  let aaveAddressesProvider;
  let lendingPool;

  let fallBackPriceOracle;

  let assets;
  let assetsMissingAddress;
  let sources;
  let sourcesMissingAddress;
  let etherTokens;

  let factory;
  let pool;
  let weth;
  let bat;
  let dai;

  const initialPoolWETH = new BN(toWei('1'));
  const initialPoolDAI= new BN(toWei('200'));
  const initialPoolBAT = new BN(toWei('1000'));

  const wethEthPrice = new BN(toWei("1"));
  const batEthPrice = new BN("1000000000000000");
  const daiEthPrice = new BN("5000000000000000");

  // Fall Back token prices are set to double the prices of the MockAggregator to be able to verify
  // if BalancerAggregator is falling back correctly to the aave fallback price oracle.

  const batEthPriceFb = new BN("2000000000000000");
  const daiEthPriceFb = new BN("10000000000000000");
    
  // To check if ChainlinkProxyPriceProvider is falling back correctly to the aave fallback price oracle
  // the pool token price inside the fallback is set to a diffrent value from the aggregated value, so it
  // can be checked later on in the tests.
  const poolTokenEthPriceFb = new BN("100000000000000000");


  const admin = accounts[0];
  const user1 = accounts[1];

  const MAX = web3.utils.toTwosComplement(-1);

  async function deployBalancerPool(_admin) {
    let _factory = await BFactory.new({from: _admin});
    let _weth = await TToken.new('Wrapped Ether', 'WETH', 18);
    let _dai = await TToken.new('Dai Stablecoin', 'DAI', 18);
    let _bat = await TToken.new('Brave Token', 'BAT', 18);

    // admin balances
    await _weth.mint(_admin, toWei('5'), {from: _admin});
    await _dai.mint(_admin, toWei('1000'), {from: _admin});
    await _bat.mint(_admin, toWei('5000'), {from: _admin});

    let _tx = await _factory.newBPool({from: _admin});
    _pool = await BPool.at(_tx.logs[0].args.pool);

    await _weth.approve(_pool.address, MAX, {from: _admin});
    await _dai.approve(_pool.address, MAX, {from: _admin});
    await _bat.approve(_pool.address, MAX, {from: _admin});

    // setting denorm to the same value "toWei(5)" will create a 33.33% weight for each token
    await _pool.bind(_weth.address, initialPoolWETH, toWei('5'), {from: _admin});
    await _pool.bind(_dai.address, initialPoolDAI, toWei('5'), {from: _admin});
    await _pool.bind(_bat.address, initialPoolBAT, toWei('5'), {from: _admin});

    return [_pool, _weth, _bat, _dai];

  }


  before(async () => {

  })

  beforeEach(async () => {

    [pool, weth, bat, dai] = await deployBalancerPool(admin);
    fallBackPriceOracle = await PriceOracle.new({from:admin});

    let _mockAggregatorBAT = await MockAggregatorBAT.new(batEthPrice,{from: admin});
    let _mockAggregatorDAI = await MockAggregatorDAI.new(daiEthPrice,{from: admin});

    await fallBackPriceOracle.setAssetPrice(weth.address, wethEthPrice, {from:admin});
    await fallBackPriceOracle.setAssetPrice(bat.address, batEthPriceFb, {from:admin});
    await fallBackPriceOracle.setAssetPrice(dai.address, daiEthPriceFb, {from:admin});
    await fallBackPriceOracle.setAssetPrice(pool.address, poolTokenEthPriceFb, {from:admin});

    assets =  [weth.address, bat.address, dai.address];
    sources = [ZERO_ADDRESS, _mockAggregatorBAT.address, _mockAggregatorDAI.address];

    etherTokens = [weth.address];

    assetsMissingAddress = [weth.address, bat.address];
    sourcesMissingAddress = [ZERO_ADDRESS, _mockAggregatorBAT.address];

  })

  it('#0 BalancerAggregator deployment must throw if the pool is not finalized ', async () => {
    await expectRevert(
      BalancerAggregator.new(
        pool.address, 
        assets, 
        sources,
        etherTokens,
        fallBackPriceOracle.address, 
        {from:admin}
      ),
      "checkAssets: The balancer pool is not finalized"
    )
  })

  it('#1 BalancerAggregator deployment must throw if the assets list does not contain all pool tokens', async () => {
    await pool.finalize({from:admin});

    // Following the implemented logic if a ether pegged tokens is present it has to be specidied in both assets array
    // and etherTokens array and its ChainlinkAggregator address set to 0x0
    await expectRevert(
      BalancerAggregator.new(
        pool.address, 
        assetsMissingAddress, 
        sourcesMissingAddress, 
        etherTokens,
        fallBackPriceOracle.address, 
        {from:admin}
      ),
      "checkAssets: One or more listed tokens in the balancer pool are not present in assets"
    )
  })

  it('#2 BalancerAggregator deployed with correct assets and finalized pool', async () => {
    await pool.finalize({from:admin});
    let balancerAggregator = await BalancerAggregator.new(
      pool.address, 
      assets, 
      sources, 
      etherTokens,
      fallBackPriceOracle.address, 
      {from:admin}
    );
  })

  it('#3 Check asset sources setter', async () => {
    await pool.finalize({from:admin});
    let balancerAggregator = await BalancerAggregator.new(
      pool.address, 
      assets, 
      sources, 
      etherTokens,
      fallBackPriceOracle.address, 
      {from:admin}
    );

    await expectRevert(
      balancerAggregator.setAssetSources(assetsMissingAddress, sourcesMissingAddress),
      "checkAssets: One or more listed tokens in the balancer pool are not present in assets"
    );

    await balancerAggregator.setAssetSources(assets, sources);
  })


  it('#4 Check if the Ether value of the pool token returned by ChainlinkProxyPriceProvider is correct', async () => {
    await pool.finalize({from:admin});
    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, 
      sources, etherTokens,
      fallBackPriceOracle.address, 
      {from:admin}
    );

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [ pool.address ],
      [ balancerAggregator.address ],
      fallBackPriceOracle.address,
      {from:admin}
    );

    let poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);
    let totalSupply = await pool.totalSupply();

    // the total value of the pools tokens is equal the totalSupply of the pool tokens multiplied by the price returned by 
    // chainlinkProxyPriceProvider
    let totalPoolEthValueFromAggregator = totalSupply.mul(poolTokenEthPrice)

    // totalPoolEthValueFromAggregator has to be equal to the sum of each token balance in the pool multiplied its price.
    // initialPoolWETH, initialPoolDAI, initialPoolBAT are the initial tokens values staked in the pool.

    let totalPoolEthValue = initialPoolWETH.mul(wethEthPrice).add(initialPoolDAI.mul(daiEthPrice)).add(initialPoolBAT.mul(batEthPrice));

    // both totalPoolEthValueFromAggregator and totalPoolEthValue have to be devided by 10**18 to get the ethereum 
    // value of the total staked amount in the pool however it is not necessary to do the division now

    chai.expect(totalPoolEthValue).to.be.bignumber.equal(totalPoolEthValueFromAggregator);
  })

  it('#5 Check if the implemented BalancerAggregator is falling back correctly to the price oracle, if one chainlink aggregators returns zero', async () => {
    await pool.finalize({from:admin});
    let totalSupply = await pool.totalSupply();

    // #STEP 1: Check if the implemented BalancerAggregator is falling back correctly to the price oracle 
    // if one chainlink aggregators returns zero.

    // _mockAggregatorBAT returns value is set to zero, batEthPrice has to be replaced with batEthPriceFb
    let _mockAggregatorBAT = await MockAggregatorBAT.new(0,{from: admin});
    let _mockAggregatorDAI = await MockAggregatorDAI.new(daiEthPrice,{from: admin});

    let _sources = [ ZERO_ADDRESS, _mockAggregatorBAT.address, _mockAggregatorDAI.address ];

    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, _sources, 
      etherTokens, fallBackPriceOracle.address, {from:admin});

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [pool.address], [balancerAggregator.address], 
      fallBackPriceOracle.address, {from:admin});

    let poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);

    let totalPoolEthValueFromAggregator = totalSupply.mul(poolTokenEthPrice)
    let totalPoolEthValue = initialPoolWETH.mul(wethEthPrice).add(initialPoolDAI.mul(daiEthPrice)).add(initialPoolBAT.mul(batEthPriceFb));

    chai.expect(totalPoolEthValue).to.be.bignumber.equal(totalPoolEthValueFromAggregator);
  })

  it('#6 Check if the implemented BalancerAggregator is falling back correctly to the price oracle, if all chainlink aggregators returns zero', async () => {
    await pool.finalize({from:admin});
    let totalSupply = await pool.totalSupply();

    // #STEP 2: Check if the implemented BalancerAggregator is falling back correctly to the price oracle 
    // if all chainlink aggregators returns zero.

    // _mockAggregatorBAT returns value is set to zero, batEthPrice has to be replaced with batEthPriceFb
    // _mockAggregatorDAI returns value is set to zero, daiEthPrice has to be replaced with daiEthPriceFb
    let _mockAggregatorBAT = await MockAggregatorBAT.new(0,{from: admin});
    let _mockAggregatorDAI = await MockAggregatorDAI.new(0,{from: admin});

    let _sources = [ ZERO_ADDRESS, _mockAggregatorBAT.address, _mockAggregatorDAI.address ];

    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, _sources, 
      etherTokens, fallBackPriceOracle.address, {from:admin});

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [pool.address], [balancerAggregator.address], 
      fallBackPriceOracle.address, {from:admin});

    let poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);

    let totalPoolEthValueFromAggregator = totalSupply.mul(poolTokenEthPrice)
    let totalPoolEthValue = initialPoolWETH.mul(wethEthPrice).add(initialPoolDAI.mul(daiEthPriceFb)).add(initialPoolBAT.mul(batEthPriceFb));

    chai.expect(totalPoolEthValue).to.be.bignumber.equal(totalPoolEthValueFromAggregator);
  })


  it('#7 Check if the ChainlinkProxyPriceProvider fallback to the aave governance price oracle if BalancerAggregator returns 0', async () => {
    await pool.finalize({from:admin});
    let totalSupply = await pool.totalSupply();

    // #STEP 3: Check if the ChainlinkProxyPriceProvider fallback to the aave governance price oracle if 
    // BalancerAggregator returns 0.

    // The BalancerAggregator will return zero if one or more chainlink aggregator and fallback price oracle 
    // of a pool token return zero at the same time.

    let _mockAggregatorBAT = await MockAggregatorBAT.new(0,{from: admin});
    let _mockAggregatorDAI = await MockAggregatorDAI.new(0,{from: admin});

    let _sources = [ ZERO_ADDRESS, _mockAggregatorBAT.address, _mockAggregatorDAI.address ];

    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, _sources, 
      etherTokens, fallBackPriceOracle.address, {from:admin});

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [pool.address], [balancerAggregator.address], 
      fallBackPriceOracle.address, {from:admin});

    await fallBackPriceOracle.setAssetPrice(bat.address, 0, {from:admin});
    poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);
    chai.expect(poolTokenEthPrice).to.be.bignumber.equal(poolTokenEthPriceFb);
  })


  it('#8 Check if the ChainlinkProxyPriceProvider latestAnswer changes when tokens are swapped through the Balancer pool', async () => {
    await pool.finalize({from:admin});

    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, sources, etherTokens,
      fallBackPriceOracle.address, {from:admin}
    );

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [ pool.address ], [ balancerAggregator.address ],
      fallBackPriceOracle.address, {from:admin}
    );

    let poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);
    let totalSupply = await pool.totalSupply();

    let totalPoolEthValueFromAggregator = totalSupply.mul(poolTokenEthPrice)
    let totalPoolEthValue = initialPoolWETH.mul(wethEthPrice).add(initialPoolDAI.mul(daiEthPrice)).add(initialPoolBAT.mul(batEthPrice));
    chai.expect(totalPoolEthValue).to.be.bignumber.equal(totalPoolEthValueFromAggregator);


    await dai.mint(user1, toWei('100'), {from: admin});
    await dai.approve(pool.address, toWei('100'), {from: user1});

    await pool.swapExactAmountIn(dai.address, toWei('100'), bat.address, 0, MAX, {from: user1});

    let newWETHPoolBalance = await pool.getBalance(weth.address);
    let newDaiPoolBalance = await pool.getBalance(dai.address);
    let newBatPoolBalance = await pool.getBalance(bat.address);

    let newPoolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);
    let newTotalPoolEthValueFromAggregator = totalSupply.mul(newPoolTokenEthPrice).div(new BN(toWei('1')));
    let newTotalPoolEthValue = newWETHPoolBalance.mul(wethEthPrice).add(newDaiPoolBalance.mul(daiEthPrice)).add(newBatPoolBalance.mul(batEthPrice)).div(new BN(toWei('1')));

    chai.expect(newTotalPoolEthValue).to.be.bignumber.closeTo(newTotalPoolEthValueFromAggregator,"100");

    chai.expect(poolTokenEthPrice).to.be.bignumber.not.equal(newPoolTokenEthPrice);
    chai.expect(totalPoolEthValue).to.be.bignumber.not.equal(newTotalPoolEthValue);
    chai.expect(totalPoolEthValueFromAggregator).to.be.bignumber.not.equal(newTotalPoolEthValueFromAggregator);
  })


  it('#9 Check if the ChainlinkProxyPriceProvider latestAnswer does not change when tokens are added the pool', async () => {
    await pool.finalize({from:admin});
    let totalSupply = await pool.totalSupply();

    let balancerAggregator = await BalancerAggregator.new(
      pool.address, assets, sources, etherTokens,
      fallBackPriceOracle.address, {from:admin}
    );

    let chainlinkProxyPriceProvider = await ChainlinkProxyPriceProvider.new(
      [ pool.address ], [ balancerAggregator.address ],
      fallBackPriceOracle.address, {from:admin}
    );


    // Leave token swap to modify the initial pool token price randomly
    await dai.mint(user1, toWei('100'), {from: admin});
    await dai.approve(pool.address, MAX, {from: user1});
    await pool.swapExactAmountIn(dai.address, toWei('100'), bat.address, 0, MAX, {from: user1});

    let poolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);

    // Leave token swap to modify the initial pool token price just for an extra verification
    await weth.mint(user1, toWei('1'), {from: admin});
    await dai.mint(user1, toWei('200'), {from: admin});
    await bat.mint(user1, toWei('1000'), {from: admin});

    // no need to approve dai to be spent since it was approved previously
    await weth.approve(pool.address, MAX, {from: user1});
    await bat.approve(pool.address, MAX, {from: user1});

    // new amount of pool token to be minted.
    let poolTokensAmountOut = new BN(toWei("50"));
    await pool.joinPool(poolTokensAmountOut, [toWei('1'), toWei('200'), toWei('1000')]);

    let newTotalSupply = await pool.totalSupply();

    let newPoolTokenEthPrice = await chainlinkProxyPriceProvider.getAssetPrice(pool.address);

    // pool token price must stay the same when token are added or removed
    chai.expect(poolTokenEthPrice).to.be.bignumber.equal(newPoolTokenEthPrice);
    chai.expect(newTotalSupply).to.be.bignumber.equal(totalSupply.add(poolTokensAmountOut));

  })
})