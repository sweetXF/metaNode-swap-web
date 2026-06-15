import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { DataTable, type Column } from '../components/DataTable';
import { getContractAddress } from '../config/contracts';
import { positionAbi } from '../abi/PositionManager';
import { formatToBigInt, shortAddress } from '../utils/format';
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from '../utils/price';
import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { ModalFooter } from '../components/ModalFooter';
import { AmountInput } from '../components/AmountInput';
import { TokenList } from '../components/TokenList';
import { wagmiConfig } from '../wagmi';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { usePositionApproval } from '../hooks/usePositionApproval';
import { poolAbi } from '../abi/PoolManager';
import { TokenPair } from '../components/TokenPair';
import { useTokenInfos } from '../hooks/useTokenInfos';
import { Selecting, type Pool, type Position, type TokenInfo } from '../config/types';
import { useTokenList } from '../hooks/useTokenList';

export const PositionPage = () => {
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const { address: account, isConnected, chainId: curChainId } = useAccount(); // 当前钱包连接状态
  const isChainidMatch = curChainId === chainId;
  const positionManagerAddress = getContractAddress(chainId, 'PositionManager');
  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');

  const [openAddPosition, setOpenAddPosition] = useState(false);
  const [addPositonError, setAddPositonError] = useState<string>('');

  const { tokenList } = useTokenList();
  const [tokenIn, setTokenIn] = useState<TokenInfo>(tokenList[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(tokenList[1]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [addPositionFee, setAddPositionFee] = useState<number>(0);
  const [poolIndex, setPoolIndex] = useState<number>();

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

  const myaccount = '0x2130DF4D9489534a5E5b8f995F81AD2151b5EA7c';
  const myaccount1 = '0xb975c82cafF9Fd068326b0Df0eD0eA0d839f24b4';
  const myPositions = positions
    ? positions.filter((p: Position) => p.owner === myaccount1 || p.owner === myaccount)
    : [];

  // 仓位池子 → 两个 (token, holder) pair
  const positionTokenInfos = useMemo(() => {
    if (!myPositions) return [];
    return myPositions.flatMap((p: Position) => [
      { token: p.token0, holder: p.owner },
      { token: p.token1, holder: p.owner },
    ]);
  }, [myPositions]);

  const { tokenMap } = useTokenInfos(positionTokenInfos);

  // 获取所有 pools
  const { data: pools } = useReadContract({
    address: poolManagerAddress,
    abi: poolAbi,
    functionName: 'getAllPools',
    query: {
      enabled: isConnected && !!chainId && isChainidMatch,
    },
  });

  //根据token0和token1获取fee：add position弹窗选定 token0 和 token1 两个下拉框，费率会自动显示。
  const getCurPool = () => {
    const inAddr = tokenIn.address;
    const outAddr = tokenOut.address;
    const curPool = pools?.find((p: Pool) => {
      const p0 = p.token0;
      const p1 = p.token1;
      return (p0 === inAddr && p1 === outAddr) || (p0 === outAddr && p1 === inAddr);
    });
    setPoolIndex(curPool?.index);
    setAddPositionFee(curPool?.fee ?? 0);
  };

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

  const handleAddPosition = async () => {
    setAddPositonError('');
    if (!account) return;
    if (addPositionFee === undefined || poolIndex === undefined) return;
    if (!amountIn || !amountOut) {
      setAddPositonError('Please enter both amounts');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: positionManagerAddress,
        abi: positionAbi,
        functionName: 'mint',
        args: [
          {
            token0: tokenIn.address,
            token1: tokenOut.address,
            index: poolIndex,
            amount0Desired: formatToBigInt(amountIn),
            amount1Desired: formatToBigInt(amountOut),
            recipient: account,
            deadline: formatToBigInt(Math.floor(Date.now() / 1000) + 60 * 30),
          },
        ],
      });

      // 等上链
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setOpenAddPosition(false);
      refetch();
    } catch (error: unknown) {
      const message =
        (error as { shortMessage?: string; message?: string })?.shortMessage ||
        (error as Error)?.message ||
        'Add position failed';
      setAddPositonError(message);
    }
  };

  //用一个 state 统一管理"哪个输入框正在选 token"
  const [selecting, setSelecting] = useState<Selecting>();
  const selectedToken =
    selecting === Selecting.In ? tokenIn : selecting === Selecting.Out ? tokenOut : undefined;

  // tokens 弹窗选中 token 时触发
  const handleSelectToken = (token: TokenInfo) => {
    // 如果选中的是另一边的 token，自动交换。（也可传disabledAddresses，禁选另一边的token）
    if (selecting === Selecting.In) {
      //如： 用户在 In 选了 XRP，但 Out 已经是 XRP，就把 Out 设为旧的 In（ETH），变成"交换两边"
      if (token.address === tokenOut.address) {
        setTokenOut(tokenIn);
      }
      setTokenIn(token);
    } else if (selecting === Selecting.Out) {
      if (token.address === tokenIn.address) {
        setTokenIn(tokenOut);
      }
      setTokenOut(token);
    }
    getCurPool();
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
          extra={
            <>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                onClick={() => {
                  setOpenAddPosition(true);
                  getCurPool();
                }}
              >
                Add Position
              </button>
              <Modal
                isOpen={openAddPosition}
                onClose={() => setOpenAddPosition(false)}
                title="Add Position"
                footer={
                  <ModalFooter
                    onClose={() => setOpenAddPosition(false)}
                    handleAddClick={handleAddPosition}
                  />
                }
              >
                <p className="text-sm pb-1">
                  <span className="text-red-500">*</span>Deposit amounts
                </p>
                <div className="space-y-1">
                  <AmountInput
                    token={tokenIn}
                    amount={amountIn}
                    onAmountChange={setAmountIn}
                    onTokenSelect={() => setSelecting(Selecting.In)}
                    showMax
                  />
                  <AmountInput
                    token={tokenOut}
                    amount={amountOut}
                    onAmountChange={setAmountOut}
                    onTokenSelect={() => setSelecting(Selecting.Out)}
                    // readOnly
                  />
                </div>

                {/* Token 选择弹窗（只渲染一次，根据 selecting 状态决定开关） */}
                <TokenList
                  tokens={tokenList}
                  open={selecting !== undefined}
                  onClose={() => setSelecting(undefined)}
                  onSelect={handleSelectToken}
                  selected={selectedToken}
                  // 如果不想要"自动交换in Out"行为，可选：直接禁选（置灰）列表中另一边的token
                  // disabledAddresses={
                  //   selecting === Selecting.In ? [tokenOut.address] :
                  //   selecting === Selecting.Out ? [tokenIn.address] : []
                  // }
                />

                <p className="text-sm pt-3 pb-1">
                  <span className="text-red-500">*</span>Fee tier
                </p>
                <p className="text-center">{addPositionFee}</p>
                {/* <FeeTierSelect disabled={!tokenIn || !tokenOut} value={addPositionFee} onChange={setAddPositionFee} /> */}

                {addPositonError ? (
                  <p className="text-red-500 p-2 text-sm">{addPositonError}</p>
                ) : null}
              </Modal>
            </>
          }
          columns={columns}
          data={myPositions as Position[] | undefined}
          loading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};
