import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { getContractAddress } from '../config/contracts';
import { positionAbi } from '../abi/PositionManager';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';

export const usePositionApproval = () => {
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
    });
    const hash = await writeContractAsync(request);
    await waitForTransactionReceipt(wagmiConfig, { hash });

    // 授权上链后刷新状态
    const { data: updated } = await refetchApproval();
    return !!updated;
  };

  return {
    isApproved: !!isApproved,
    isCheckingApproval,
    isApproving,
    ensureApproved,
    refetchApproval,
  };
};
