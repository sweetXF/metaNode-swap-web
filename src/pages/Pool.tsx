import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { poolAbi } from '../abi/PoolManager';
import { getContractAddress } from '../config/contracts';
import { DataTable, type Column } from '../components/DataTable';
import { TokenPair } from '../components/TokenPair';
import { useTokenInfos } from '../hooks/useTokenInfos';
import { useMemo, useState } from 'react';
import { formatBigInt, formatToBigInt } from '../utils/format';
import {
  formatFeeTier,
  formatPriceRange,
  priceToSqrtPriceX96,
  priceToTick,
  sqrtPriceX96ToPrice,
} from '../utils/price';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { ModalFooter } from '../components/ModalFooter';
import { AmountInput } from '../components/AmountInput';
import { FeeTierSelect } from '../components/FeeTierSelect';
import { CellInput } from '../components/CellInput';
import { TokenList } from '../components/TokenList';
import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';
import { Selecting, type Pool, type TokenInfo } from '../config/types';
import { useTokenList } from '../hooks/useTokenList';
import { usePositionApproval } from '../hooks/usePositionApproval';
import { positionAbi } from '../abi/PositionManager';

export const PoolPage = () => {
  const navigate = useNavigate();
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const { address: account, isConnected, chainId: curChainId } = useAccount(); // 当前钱包连接状态
  const isChainidMatch = curChainId === chainId;

  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');
  const positionManagerAddress = getContractAddress(chainId, 'PositionManager');

  const { tokenList } = useTokenList();
  // Add pool
  const [openAddPool, setOpenAddPool] = useState(false);
  const [addPoolError, setAddPoolError] = useState('');
  const [tokenIn, setTokenIn] = useState<TokenInfo>(tokenList[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(tokenList[1]);
  const [fee, setFee] = useState('');
  const [lowPrice, setLowPrice] = useState('');
  const [highPrice, setHighPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

  // Add position
  const [processing, setProcessing] = useState<{ id: number } | null>(null);
  const [openAddPosition, setOpenAddPosition] = useState(false);
  const [addPositonError, setAddPositonError] = useState<string>('');
  const [addPositionTokenIn, setAddPositionTokenIn] = useState<TokenInfo>();
  const [addPositionTokenOut, setAddPositionTokenOut] = useState<TokenInfo>();
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [addPositionFee, setAddPositionFee] = useState<number>(0);
  const [addPositionCurPool, setAddPositionCurPool] = useState<Pool>();
  const { isApproved, ensureApproved } = usePositionApproval();

  const {
    data: pools,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: poolManagerAddress,
    abi: poolAbi,
    functionName: 'getAllPools',
    query: {
      enabled: !!chainId,
    },
  });

  // 每个池子 → 两个 (token, holder) pair
  const poolTokenInfos = useMemo(() => {
    if (!pools) return [];
    return pools.flatMap((p: Pool) => [
      { token: p.token0, holder: p.pool },
      { token: p.token1, holder: p.pool },
    ]);
  }, [pools]);

  const { tokenMap, isTokenInfoLoading, fetchTokenInfo } = useTokenInfos(poolTokenInfos);

  const { writeContractAsync, isPending } = useWriteContract();

  //用于add pool时判断是否已存在该池子
  const curAddPool = useMemo(() => {
    const inAddr = tokenIn.address;
    const outAddr = tokenOut.address;
    return pools?.find((pool: Pool) => {
      const p0 = pool.token0;
      const p1 = pool.token1;
      return (
        ((p0 === inAddr && p1 === outAddr) || (p0 === outAddr && p1 === inAddr)) &&
        pool.fee === Number(fee) &&
        pool.tickLower === priceToTick(lowPrice) &&
        pool.tickUpper === priceToTick(highPrice)
      );
    });
  }, [pools, tokenIn, tokenOut, fee, lowPrice, highPrice]);

  const handleAddPool = async () => {
    setAddPoolError('');
    if (!fee) {
      setAddPoolError('Please enter fee');
      return;
    }
    // if (!amountIn || !amountOut) {
    //   setAddPoolError('Please enter both amounts');
    //   return;
    // }
    if (!lowPrice || !highPrice) {
      setAddPoolError('Please enter low and high price');
      return;
    }
    if (!currentPrice) {
      setAddPoolError('Please enter current price');
      return;
    }
    if (+currentPrice < +lowPrice || +currentPrice > +highPrice) {
      setAddPoolError('Current price must be between low and high price');
      return;
    }

    if (curAddPool) {
      setAddPoolError('Pool already exists');
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: poolManagerAddress,
        abi: poolAbi,
        functionName: 'createAndInitializePoolIfNecessary',
        args: [
          {
            token0: tokenIn.address,
            token1: tokenOut.address,
            fee: Number(fee), //uint24
            tickLower: priceToTick(lowPrice), //int24
            tickUpper: priceToTick(highPrice),
            sqrtPriceX96: priceToSqrtPriceX96(currentPrice),
          },
        ],
      });

      // 等上链
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setOpenAddPool(false);
      refetch();
    } catch (error: unknown) {
      const message =
        (error as { shortMessage?: string; message?: string })?.shortMessage ||
        (error as Error)?.message ||
        'Add pool failed';
      setAddPoolError(message);
    }
  };

  const handleOpenAddPosition = (pool: Pool) => {
    setOpenAddPosition(true);
    setAddPositionCurPool(pool);
    const token0Addr = { token: pool.token0 };
    const token0Info = fetchTokenInfo(token0Addr);
    const token1Addr = { token: pool.token1 };
    const token1Info = fetchTokenInfo(token1Addr);
    setAddPositionTokenIn(token0Info);
    setAddPositionTokenOut(token1Info);
    setAddPositionFee(pool.fee);
  };

  // Add position
  const handleAddPosition = async (pool: Pool) => {
    setAddPositonError('');
    if (!isConnected || !account || !isChainidMatch || !isApproved || !pool) return;
    if (!addPositionTokenIn || !addPositionTokenOut) return;
    if (!amountIn || !amountOut) {
      setAddPositonError('Please enter both amounts');
      return;
    }

    setAddPositionCurPool(pool);
    try {
      const hash = await writeContractAsync({
        address: positionManagerAddress,
        abi: positionAbi,
        functionName: 'mint',
        args: [
          {
            token0: addPositionTokenIn.address,
            token1: addPositionTokenOut.address,
            index: pool.index,
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

  /** add pool 弹窗 token 选择
   * 用一个 state 统一管理"哪个输入框正在选 token"
   * 如果选中的是另一边的 token，自动交换。（也可传disabledAddresses，禁选另一边的token）
   * 如： 用户在 In 选了 XRP，但 Out 已经是 XRP，就把 Out 设为旧的 In（ETH），变成"交换两边"
   */
  const [selecting, setSelecting] = useState<Selecting>();
  const selectedToken =
    selecting === Selecting.In ? tokenIn : selecting === Selecting.Out ? tokenOut : undefined;
  // 弹窗选中 token 时触发
  const handleSelectToken = (token: TokenInfo) => {
    if (selecting === Selecting.In) {
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
  };

  /** add position 弹窗 token 选择
   * 同理 add pool
   */
  const [positionSelecting, setPositionSelecting] = useState<Selecting>();
  const positionSelectedToken =
    positionSelecting === Selecting.In
      ? addPositionTokenIn
      : positionSelecting === Selecting.Out
        ? addPositionTokenOut
        : undefined;
  // 弹窗选中 token 时触发
  const handlePositionSelectToken = (token: TokenInfo) => {
    if (!addPositionTokenOut || !addPositionTokenIn) return;
    if (positionSelecting === Selecting.In) {
      if (token.address === addPositionTokenOut.address) {
        setAddPositionTokenOut(addPositionTokenIn);
      }
      setAddPositionTokenIn(token);
    } else if (positionSelecting === Selecting.Out) {
      if (token.address === addPositionTokenIn.address) {
        setAddPositionTokenIn(addPositionTokenOut);
      }
      setAddPositionTokenOut(token);
    }
  };

  // render:(row) => <TokenPair token0={row.token0} token1={row.token1} tokenMap={tokenMap} />,
  // render:(row) => `${shortAddress(row.token0)} / ${shortAddress(row.token1)}`,
  const columns: Column<Pool>[] = [
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
      render: row => sqrtPriceX96ToPrice(row.sqrtPriceX96).toFixed(3),
    },
    {
      key: 'liquidity',
      label: 'Liquidity',
      render: row => formatBigInt(row.liquidity),
    },
    ...(isConnected && account && isChainidMatch
      ? [
          {
            key: 'action',
            label: 'Action',
            render: (row: Pool) => {
              return (
                <div className="flex items-center gap-2">
                  <button
                    className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleOpenAddPosition(row)}
                  >
                    Add position
                  </button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Pool</p>

        <DataTable<Pool>
          title="Pool list"
          extra={
            <>
              {/* 需在App.tsx中添加路由<Route path="/position" element={<PositionPage />} /> */}
              <button
                className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition"
                onClick={() => navigate('/position')}
              >
                My Positions
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                onClick={() => {
                  setAddPoolError('');
                  if (!isConnected || !isChainidMatch) {
                    alert('Please connect your wallet to Sepolia network');
                    return;
                  }
                  setOpenAddPool(true);
                }}
              >
                Add Pool
              </button>

              {/* Add Pool Modal 弹窗*/}
              <Modal
                isOpen={openAddPool}
                onClose={() => setOpenAddPool(false)}
                title="Add Pool"
                footer={
                  <ModalFooter
                    onClose={() => setOpenAddPool(false)}
                    handleAddClick={handleAddPool}
                    isConfirming={isPending}
                  />
                }
              >
                <p className="text-sm pb-1">
                  <span className="text-red-500">*</span>Deposit amounts
                </p>
                <div className="space-y-1">
                  <AmountInput
                    token={tokenIn}
                    // amount={amountIn}
                    // onAmountChange={setAmountIn}
                    onTokenSelect={() => setSelecting(Selecting.In)}
                    showBalance={false}
                    readOnly
                  />
                  <AmountInput
                    token={tokenOut}
                    // amount={amountOut}
                    // onAmountChange={setAmountOut}
                    onTokenSelect={() => setSelecting(Selecting.Out)}
                    showBalance={false}
                    readOnly
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
                <CellInput
                  value={fee}
                  onChange={setFee}
                  placeholder="Fee tier"
                  disabled={!tokenIn || !tokenOut}
                />
                {/* <FeeTierSelect disabled={!tokenIn || !tokenOut} value={fee} onChange={setFee} /> */}

                <p className="text-sm pt-3 pb-1">
                  <span className="text-red-500">*</span>Set price range
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <CellInput
                    value={lowPrice}
                    onChange={setLowPrice}
                    placeholder="Low price"
                    disabled={!tokenIn || !tokenOut}
                    // unit={`${symbol1} per ${symbol0}`}
                  />
                  <CellInput
                    value={highPrice}
                    onChange={setHighPrice}
                    placeholder="High price"
                    disabled={!tokenIn || !tokenOut}
                  />
                </div>

                <p className="text-sm pt-3 pb-1">
                  <span className="text-red-500">*</span>Current price
                </p>
                <CellInput
                  value={currentPrice}
                  onChange={setCurrentPrice}
                  placeholder="current price"
                  disabled={!tokenIn || !tokenOut}
                />

                {addPoolError ? <p className="text-red-500 p-2 text-sm">{addPoolError}</p> : null}
              </Modal>

              {/* table action Add position Modal 弹窗*/}
              <Modal
                isOpen={openAddPosition}
                onClose={() => setOpenAddPosition(false)}
                title="Add Position"
                footer={
                  <ModalFooter
                    onClose={() => setOpenAddPosition(false)}
                    isConfirming={isPending}
                    handleAddClick={() => {
                      if (!addPositionCurPool) return;
                      handleAddPosition(addPositionCurPool);
                    }}
                  />
                }
              >
                <p className="text-sm pb-1">
                  <span className="text-red-500">*</span>Deposit amounts
                </p>
                <div className="space-y-1">
                  <AmountInput
                    token={addPositionTokenIn}
                    amount={amountIn}
                    onAmountChange={setAmountIn}
                    onTokenSelect={() => setPositionSelecting(Selecting.In)}
                    showMax
                  />
                  <AmountInput
                    token={addPositionTokenOut}
                    amount={amountOut}
                    onAmountChange={setAmountOut}
                    onTokenSelect={() => setPositionSelecting(Selecting.Out)}
                    // readOnly
                  />
                </div>

                {/* Token 选择弹窗（只渲染一次，根据 selecting 状态决定开关） */}
                <TokenList
                  tokens={tokenList}
                  open={positionSelecting !== undefined}
                  onClose={() => setPositionSelecting(undefined)}
                  onSelect={handlePositionSelectToken}
                  selected={positionSelectedToken}
                  // 如果不想要"自动交换in Out"行为，可选：直接禁选（置灰）列表中另一边的token
                  // disabledAddresses={
                  //   positionSelecting === Selecting.In ? [positionTokenOut.address] :
                  //   positionSelecting === Selecting.Out ? [positionTokenIn.address] : []
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
          data={pools as Pool[] | undefined}
          loading={isLoading || isTokenInfoLoading}
          error={error}
        />
      </div>
    </div>
  );
};
