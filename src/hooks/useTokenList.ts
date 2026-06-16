import { useChainId, useReadContract } from 'wagmi';
import { poolAbi } from '../abi/PoolManager';
import { getContractAddress } from '../config/contracts';
import { useMemo } from 'react';
import { useTokenInfos } from './useTokenInfos';
import type { TokenInfo } from '../config/types';

export const useTokenList = () => {
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');

  // 获取池中所有 pairs交易对
  const { data: pairs } = useReadContract({
    address: poolManagerAddress,
    abi: poolAbi,
    functionName: 'getPairs',
    query: {
      enabled: !!chainId,
    },
  });

  // 获取所有 token 地址（去重）
  const allTokenAddrs = useMemo(() => {
    if (!pairs) return [];
    const set = new Set<`0x${string}`>();
    pairs?.forEach(p => {
      set.add(p.token0);
      set.add(p.token1);
    });
    return Array.from(set).map(addr => ({ token: addr }));
  }, [pairs]);

  const { tokenMap } = useTokenInfos(allTokenAddrs);
  const tokenList: TokenInfo[] = useMemo(() => {
    if (!tokenMap) return [];
    return Array.from(tokenMap.entries()).map(([key, value]) => ({
      address: key,
      symbol: value.symbol,
      decimals: value.decimals,
      balance: value.balance,
    }));
  }, [tokenMap]);

  return { tokenList };
};
