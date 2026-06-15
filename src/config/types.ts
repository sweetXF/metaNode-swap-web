export type Pool = {
  fee: number; // 手续费率（所有 LP 共享）
  feeProtocol: number;
  index: number;
  liquidity: bigint; // 池子总流动性（所有 LP 累加）
  pool: `0x${string}`;
  sqrtPriceX96: bigint; // 当前价格
  tick: number;
  tickLower: number;
  tickUpper: number;
  token0: `0x${string}`;
  token1: `0x${string}`;
};

export type Position = {
  fee: number;
  feeGrowthInside0LastX128: bigint; //上次提取手续费时的 feeGrowthGlobal0X128
  feeGrowthInside1LastX128: bigint; // 上次提取手续费时的 feeGrowthGlobal1X128
  id: bigint; // 仓位编号 positionId
  index: number; // 位置编号,属于哪个 pool
  liquidity: bigint; // 该 Position 拥有的流动性
  owner: `0x${string}`; // 拥有者（具体用户）
  tickLower: number; // 用户主动选择的窄区间
  tickUpper: number;
  token0: `0x${string}`;
  token1: `0x${string}`;
  tokensOwed0: bigint; // 可提取的 token0 数量
  tokensOwed1: bigint; // 可提取的 token1 数量
};

export enum Selecting {
  In,
  Out,
}

export type TokenInfo = {
  address: `0x${string}`;
  symbol?: string;
  decimals?: number;
  balance?: bigint;
  owner?: `0x${string}`;
};
