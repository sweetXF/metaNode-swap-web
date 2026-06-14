import { useChainId, useReadContract } from 'wagmi';
import { poolAbi } from '../abi/PoolManager';
import { getContractAddress } from '../config/contracts';
import { useMemo } from 'react';

export const usePoolTokens = () => {
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
    const set = new Set<`0x${string}`>();
    pairs?.forEach(p => {
      set.add(p.token0);
      set.add(p.token1);
    });
    return [...set];
  }, [pairs]);

  return { pairs, allTokenAddrs };
};
