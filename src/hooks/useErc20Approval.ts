import { erc20Abi } from 'viem';
import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { getContractAddress } from '../config/contracts';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';

export const useErc20Approval = (tokenAddress?: `0x${string}`, spender?: `0x${string}`) => {
  const { address: account } = useAccount();
  const chainId = useChainId();
  const contractAddress = spender ?? getContractAddress(chainId, 'PositionManager');
  const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn; // 标准uint256最大值,替代 2n**256n -1n
  const { writeContractAsync, isPending: isApproving } = useWriteContract();

  //读取当前授权额度 ERC20 allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account && tokenAddress ? [account, contractAddress] : undefined,
    query: {
      enabled: !!account && !!tokenAddress,
    },
  });

  /**
   * 授权代币给 contractAddress
   * @param amount 授权数量 bigint，建议传无限大 2n**256n -1n
   */
  const approveToken = async (amount: bigint) => {
    if (!account || !tokenAddress) throw new Error('no account or tokenAddress');
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddress, amount],
        account,
      });
      const hash = await writeContractAsync(request);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchAllowance(); //刷新授权额度
      return true;
    } catch (err) {
      console.error('approveToken failed:', err);
      return false;
    }
  };

  // 自动校验额度，不足则授权无限额度
  const ensureApprovedAllowance = async (amount: bigint) => {
    if (!account || !tokenAddress) {
      throw new Error('no account or tokenAddress');
    }
    try {
      const { data: latestAllowance } = await refetchAllowance(); //先刷新获取最新allowance，避免缓存旧数据
      if (latestAllowance && latestAllowance >= amount) return true; // 当前授权额度 >= 需要数量，无需授权

      return await approveToken(MAX_UINT256); // 授权无限额度，避免后续反复授权
    } catch (err) {
      console.error('ensureApprovedAllowance failed:', err);
      return false;
    }
  };
  return {
    allowance,
    isApproving,
    approveToken,
    ensureApprovedAllowance,
  };
};
