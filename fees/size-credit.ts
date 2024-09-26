import ADDRESSES from '../helpers/coreAssets.json';
import { Adapter, FetchOptions } from "../adapters/types";
import { CHAIN } from "../helpers/chains";

interface Market {
  Size: string,
  UnderlyingCollateralToken: string,
  UnderlyingBorrowAToken: string,
  CollateralToken: string,
  BorrowAToken: string
}


const config: Record<string, Record<string, Market>> = {
  [CHAIN.BASE]: {
    WETH_USDC: {
      Size: '0xC2a429681CAd7C1ce36442fbf7A4a68B11eFF940',
      UnderlyingCollateralToken: ADDRESSES.base.WETH,
      UnderlyingBorrowAToken: '0x4e65fe4dba92790696d040ac24aa414708f5c0ab',
      CollateralToken: '0x974583f05de1fd18c59c77c4a8803cf0c7db5333',
      BorrowAToken: '0x38978038a06a21602a4202dfa66968e7f525bf3e',
    }
  },
}

const fetch: any = async (options: FetchOptions, markets: Market[]) => {
  const { createBalances, getLogs, api, getFromBlock, getToBlock } = options
  const fees = createBalances()
  const [fromBlock, toBlock] = await Promise.all([getFromBlock(), getToBlock()])
  for (const market of markets) {
    const FEE_MAPPING = [
      market.UnderlyingCollateralToken,
      market.UnderlyingBorrowAToken
    ]
    const logsArray = await Promise.all([
      getLogs({
        target: market.CollateralToken,
        eventAbi: "event Transfer(address indexed from, address indexed to, uint256 value)",
        fromBlock,
        toBlock
      }),
      getLogs({
        target: market.BorrowAToken,
        eventAbi: "event TransferUnscaled(address indexed from, address indexed to, uint256 value)",
        fromBlock,
        toBlock
      })
    ])
    const feeConfig = await api.call({
      target: market.Size,
      abi: "function feeConfig() view returns (uint256 swapFeeAPR, uint256 fragmentationFee, uint256 liquidationRewardPercent, uint256 overdueCollateralProtocolPercent, uint256 collateralProtocolPercent, address feeRecipient)",
      params: [],
    });
    const feeRecipient = feeConfig.feeRecipient;
    logsArray.forEach((logs, i) => {
      logs.forEach((log) => {
        if (log.to.toLowerCase() === feeRecipient.toLowerCase()) {
          fees.add(FEE_MAPPING[i], Number(log.value));
        }
      })
    })
  }

  return {
    dailyFees: fees,
    dailyRevenue: fees,
    dailyProtocolRevenue: fees
  };
};

const methodology = "Swap fees are applied on every cash-for-credit trade, and fragmentation fees are charged on every credit split"

const adapter: Adapter = {
  version: 2,
  adapter: {}
}

Object.keys(config).forEach((chain) => {
  adapter.adapter[chain] = {
    fetch: (options: FetchOptions) => fetch(options, Object.values(config[chain])),
    start: 1721083903,
    meta: {
      methodology: {
        Fees: methodology,
        ProtocolRevenue: methodology
      }
    }
  }
})

export default adapter;
