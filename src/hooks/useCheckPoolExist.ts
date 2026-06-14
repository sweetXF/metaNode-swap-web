import { useChainId, useReadContract } from 'wagmi';
import { getContractAddress } from '../config/contracts';
import { poolAbi } from '../abi/PoolManager';
import { zeroAddress, type Address } from 'viem';

export const useCheckPoolExist = async (tokenA: Address, tokenB: Address, index: number) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId, 'PoolManager');
  const { data: poolAddress } = useReadContract({
    address: contractAddress,
    abi: poolAbi,
    functionName: 'getPool',
    args: [tokenA, tokenB, index],
    query: {
      enabled: !!tokenA && !!tokenB && !!index,
    },
  });

  const isInitialPool = poolAddress === zeroAddress; // true: 初始池

  return { isInitialPool, poolAddress };
};
