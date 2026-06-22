import { readContract } from '@wagmi/core';
import type { Pool } from '../config/types';
import { getContractAddress } from '../config/contracts';
import { poolAbi } from '../abi/PoolManager';
import { wagmiConfig } from '../wagmi';

/**
 * 根据滑点计算 sqrtPriceLimitX96
 * @param chainId 链ID
 * @param tokenInAddr 输入代币地址
 * @param tokenOutAddr 输出代币地址
 * @param slippagePercent 页面滑点百分比，如 "5.5" = 5.5%
 * @param isExactInput true=exactInput / false=exactOutput
 */
export const getSwapBestPoolAndPriceLimit = async (
  chainId: number,
  tokenInAddr: `0x${string}`,
  tokenOutAddr: `0x${string}`,
  slippagePercent: string,
  isExactInput: boolean
): Promise<{ bestPoolIndex: number; sqrtPriceLimit: bigint }> => {
  if (!chainId) throw new Error('no chainId');
  if (+slippagePercent < 0 || +slippagePercent > 100)
    throw new Error('Slippage must be between 0 and 100');

  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');
  const pools = await readContract(wagmiConfig, {
    address: poolManagerAddress,
    abi: poolAbi,
    functionName: 'getAllPools',
  });

  // 过滤出当前交易对所有池子
  const inAddr = tokenInAddr.toLowerCase();
  const outAddr = tokenOutAddr.toLowerCase();
  const curPairsPools = pools.filter((p: Pool) => {
    const t0 = p.token0.toLowerCase();
    const t1 = p.token1.toLowerCase();
    return (t0 === inAddr && t1 === outAddr) || (t0 === outAddr && t1 === inAddr);
  });
  if (curPairsPools.length === 0) throw new Error('No pool exists for this pair');
  // 按 liquidity 从大到小排序，取第一个index（liquidity最大的池子index）
  curPairsPools.sort((a: Pool, b: Pool) => {
    if (a.liquidity > b.liquidity) return -1; // a更大 → a放前面
    if (a.liquidity < b.liquidity) return 1; // b更大 → b放前面
    return 0; //a.liquidity = b.liquidity 顺序不变
  });
  const bestPoolIndex = curPairsPools[0].index;
  const sqrtPriceX96 = curPairsPools[0].sqrtPriceX96;

  let scale: number;
  const slippage = Number(slippagePercent) / 100;
  if (isExactInput) {
    // 输入固定tokenIn，允许价格下跌，下限 sqrt(P*(1-slippage)),低于此价拒绝成交
    scale = Math.sqrt(1 - slippage);
  } else {
    // 输出固定tokenOut，允许价格上涨，上限 sqrt(P*(1+slippage)),高于此价拒绝成交
    scale = Math.sqrt(1 + slippage);
  }

  // 向下取整，防止限价过松导致实际滑点超过设置值
  const sqrtPriceLimit = BigInt(Math.floor(Number(sqrtPriceX96) * scale));

  return { bestPoolIndex, sqrtPriceLimit };
};
