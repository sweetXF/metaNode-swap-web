import { useMemo } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';

export const useTokenInfos = (tokenAddrs: `0x${string}`[], owner?: `0x${string}`) => {
  const { address: user } = useAccount();
  const Addr = owner ?? user;
  // 一次性读所有 token 的 symbol/decimals/balance
  const { data, isLoading } = useReadContracts({
    contracts: tokenAddrs.flatMap(tokenAddr => [
      {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'symbol',
      },
      {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [Addr],
      },
    ]),
    query: {
      enabled: !!Addr && tokenAddrs.length > 0,
    },
  });
  console.log('token erc20 data', data);

  //address -> { symbol, decimals, balance }
  const tokenMap = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number; balance: bigint }>();
    tokenAddrs.forEach((addr, i) => {
      m.set(addr, {
        symbol: data?.[i * 3]?.result as string,
        decimals: (data?.[i * 3 + 1]?.result as number) ?? 18,
        balance: (data?.[i * 3 + 2]?.result as bigint) ?? 0n,
      });
    });
    return m;
  }, [data, tokenAddrs]);

  return { tokenMap, isLoading };
};
