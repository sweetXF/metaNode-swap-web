import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { DataTable, type Column } from '../components/DataTable';
import { getContractAddress } from '../config/contracts';
import { positionAbi } from '../abi/PositionManager';
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from '../utils/price';
import { useMemo, useState } from 'react';

import { wagmiConfig } from '../wagmi';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { usePositionApproval } from '../hooks/usePositionApproval';
import { poolAbi } from '../abi/PoolManager';
import { TokenPair } from '../components/TokenPair';
import { useTokenInfos } from '../hooks/useTokenInfos';
import { type Position } from '../config/types';

export const PositionPage = () => {
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const { address: account, isConnected, chainId: curChainId } = useAccount(); // 当前钱包连接状态
  const isChainidMatch = curChainId === chainId;
  const positionManagerAddress = getContractAddress(chainId, 'PositionManager');
  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');

  const { isApproved, ensureApproved } = usePositionApproval();

  const {
    data: positions,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: positionManagerAddress,
    abi: positionAbi,
    functionName: 'getAllPositions',
    query: {
      enabled: isConnected && !!chainId && isChainidMatch,
    },
  });

  const myPositions = positions ? positions.filter((p: Position) => p.owner === account) : [];

  // 仓位池子 → 两个 (token, holder) pair
  const positionTokenInfos = useMemo(() => {
    if (!myPositions) return [];
    return myPositions.flatMap((p: Position) => [
      { token: p.token0, holder: p.owner },
      { token: p.token1, holder: p.owner },
    ]);
  }, [myPositions]);

  const { tokenMap, isTokenInfoLoading } = useTokenInfos(positionTokenInfos);

  // 获取所有 pools
  const { data: pools } = useReadContract({
    address: poolManagerAddress,
    abi: poolAbi,
    functionName: 'getAllPools',
    query: {
      enabled: isConnected && !!chainId && isChainidMatch,
    },
  });

  // 发送写交易（手动 await，便于区分操作行与捕获错误）
  const { writeContractAsync } = useWriteContract();

  // 表中最后一列actions当前正在处理的行为操作类型（用于区分每一行、每个按钮的 loading 态）
  const [processing, setProcessing] = useState<{ id: bigint; action: 'remove' | 'collect' } | null>(
    null
  );
  // 最近一次操作的错误信息
  const [actionError, setActionError] = useState<string>();

  const handleRemove = async (row: Position) => {
    if (row.liquidity !== 0n) {
      alert('please collect first');
      return;
    }
    setActionError(undefined);
    setProcessing({ id: row.id, action: 'remove' });
    try {
      // 1. 确保已授权（usePositionApproval内部完成：读取最新状态 → 模拟 → 发送 → 等待上链 → 刷新状态）
      const approved = await ensureApproved();
      if (!approved) throw new Error('Approval not completed');

      // 2. 先模拟交易、校验、拿 request，发现错误立即报，不花 gas
      const { request } = await simulateContract(wagmiConfig, {
        address: positionManagerAddress,
        abi: positionAbi,
        functionName: 'burn',
        args: [row.id],
        account,
      });

      // 3. 模拟成功，发送交易并等待上链
      const hash = await writeContractAsync(request);
      await waitForTransactionReceipt(wagmiConfig, { hash });

      // 4. 成功后刷新列表
      await refetch();
    } catch (error: unknown) {
      const msg =
        (error as { shortMessage?: string; message?: string })?.shortMessage ||
        (error as Error)?.message ||
        'Remove failed';
      console.error('Remove failed:', error);
      setActionError(msg);
    } finally {
      setProcessing(null);
    }
  };

  const handleCollect = async (row: Position) => {
    if (!account) return;
    setActionError(undefined);
    setProcessing({ id: row.id, action: 'collect' });
    try {
      const { request } = await simulateContract(wagmiConfig, {
        address: positionManagerAddress,
        abi: positionAbi,
        functionName: 'collect',
        args: [row.id, account],
        account,
      });
      const hash = await writeContractAsync(request);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetch();
    } catch (error: unknown) {
      const msg =
        (error as { shortMessage?: string; message?: string })?.shortMessage ||
        (error as Error)?.message ||
        'Collect failed';
      console.error('Collect failed:', error);
      setActionError(msg);
    } finally {
      setProcessing(null);
    }
  };

  const columns: Column<Position>[] = [
    {
      key: 'token',
      label: 'Token',
      render: row => <TokenPair token0={row.token0} token1={row.token1} tokenMap={tokenMap} />,
    },
    {
      key: 'fee',
      label: 'Fee tier',
      render: row => formatFeeTier(row.fee),
    },
    {
      key: 'range',
      label: 'Set price range',
      render: row => formatPriceRange(row.tickLower, row.tickUpper),
    },
    {
      key: 'price',
      label: 'Current price',
      render: row => {
        const sqrtPriceX96 =
          pools?.find(
            p => p.token0 === row.token0 && p.token1 === row.token1 && p.index === row.index
          )?.sqrtPriceX96 ?? 0n;
        return sqrtPriceX96 ? sqrtPriceX96ToPrice(sqrtPriceX96).toFixed(3) : '0.000';
      },
    },
    {
      key: 'index',
      label: 'index',
      render: row => row.index,
    },
    {
      key: 'id',
      label: 'Position id',
      render: row => row.id,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => {
        // 仅当前操作的行进入 loading，避免全局串扰
        const isRemoving = processing?.id === row.id && processing.action === 'remove';
        const isCollecting = processing?.id === row.id && processing.action === 'collect';
        const anyProcessing = processing !== null;
        return (
          <div className="flex items-center gap-2">
            <button
              disabled={anyProcessing}
              className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleRemove(row)}
            >
              {isRemoving ? (isApproved ? 'Removing...' : 'Approving...') : 'Remove'}
            </button>
            <button
              disabled={anyProcessing}
              className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleCollect(row)}
            >
              {isCollecting ? 'Collecting...' : 'Collect'}
            </button>
          </div>
        );
      },
    },
  ];

  if (!isConnected || !isChainidMatch) {
    return (
      <div className="max-w-7xl mx-auto p-5">
        <p className="text-2xl font-semibold text-gray-900 mb-2 text-left">Positions</p>
        {!isConnected && <p className="text-gray-500">Connect your wallet</p>}
        {isConnected && !isChainidMatch && (
          <p className="text-gray-500">Connect your wallet to Sepolia network</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Positions</p>

        {actionError && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
            {actionError}
          </div>
        )}

        <DataTable<Position>
          title="My Positions"
          columns={columns}
          data={myPositions as Position[] | undefined}
          loading={isLoading || isTokenInfoLoading}
          error={error}
        />
      </div>
    </div>
  );
};
