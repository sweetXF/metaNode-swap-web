import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { getContractAddress } from '../config/contracts';
import { positionAbi } from '../abi/PositionManager';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';
import { erc20Abi } from 'viem';

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn; // 标准uint256最大值,替代 2n**256n -1n

export const usePositionApproval = (tokenAddress?: `0x${string}`) => {
  const chainId = useChainId();
  const { address: account } = useAccount();
  const contractAddress = getContractAddress(chainId, 'PositionManager');

  // 检查是否已经授权（owner = account, operator = PositionManager）
  const {
    data: isApproved,
    isLoading: isCheckingApproval,
    refetch: refetchApproval,
  } = useReadContract({
    address: contractAddress,
    abi: positionAbi,
    functionName: 'isApprovedForAll',
    args: account ? [account, contractAddress] : undefined,
    query: {
      enabled: !!account,
    },
  });

  const { writeContractAsync, isPending: isApproving } = useWriteContract();

  /**
   * 确保已授权：
   * 1. 先读取链上最新授权状态，已授权则直接返回 true；
   * 2. 否则模拟 setApprovalForAll → 发送交易 → 等待上链 → 刷新本地授权状态；
   * 3. 返回最终是否已授权。
   */
  const ensureApproved = async (): Promise<boolean> => {
    if (!account) throw new Error('no account');

    // 读取最新状态，避免使用过期缓存
    const { data: latest } = await refetchApproval();
    if (latest) return true;

    const { request } = await simulateContract(wagmiConfig, {
      address: contractAddress,
      abi: positionAbi,
      functionName: 'setApprovalForAll',
      args: [contractAddress, true],
      account,
    });
    const hash = await writeContractAsync(request);
    await waitForTransactionReceipt(wagmiConfig, { hash });

    // 授权上链后刷新状态
    await refetchApproval();
    const { data: updated } = await refetchApproval();
    return !!updated;
  };

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
   * 授权代币给 PositionManager
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
    isApproved: !!isApproved,
    isCheckingApproval,
    isApproving,
    ensureApproved,
    refetchApproval,
    allowance,
    refetchAllowance,
    approveToken,
    ensureApprovedAllowance,
  };
};
