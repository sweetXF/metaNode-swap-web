import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { poolAbi } from '../abi/PoolManager';
import { getContractAddress } from '../config/contracts';
import { DataTable, type Column } from '../components/DataTable';
import { TokenPair } from '../components/TokenPair';
import { useTokenInfos } from '../hooks/useTokenInfos';
import { useMemo, useState } from 'react';
import { formatBigInt, shortAddress } from '../utils/format';
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
import { AmountInput, type TokenInfo } from '../components/AmountInput';
import { FeeTierSelect } from '../components/FeeTierSelect';
import { CellInput } from '../components/CellInput';
import { TokenList } from '../components/TokenList';
import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';
import { Selecting, type Pool } from '../config/types';

// 临时硬编码 token（后续应该从 token 列表取）
const TOKEN_LIST: TokenInfo[] = [
  { address: '0x4798388e3adE569570Df626040F07DF71135C48E', symbol: 'MNTokenA' },
  { address: '0x5A4eA3a013D42Cfd1B1609d19f6eA998EeE06D30', symbol: 'MNTokenB' },
  { address: '0x86B5df6FF459854ca91318274E47F4eEE245CF28', symbol: 'MNTokenC' },
  { address: '0x7af86B1034AC4C925Ef5C3F637D1092310d83F03', symbol: 'MNTokenD' },
];

export const PoolPage = () => {
  const navigate = useNavigate();
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const { isConnected, chainId: curChainId } = useAccount(); // 当前钱包连接状态
  const isChainidMatch = curChainId === chainId;

  const poolManagerAddress = getContractAddress(chainId, 'PoolManager');

  const [openAddPool, setOpenAddPool] = useState(false);
  const [addPoolError, setAddPoolError] = useState('');

  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKEN_LIST[1]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [fee, setFee] = useState('3000');
  const [lowPrice, setLowPrice] = useState('');
  const [highPrice, setHighPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

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

  // 收集所有不重复的 token 地址
  const allTokenAddrs = useMemo(() => {
    const set = new Set<`0x${string}`>();
    pools?.forEach((pool: Pool) => {
      set.add(pool.token0);
      set.add(pool.token1);
    });
    return [...set];
  }, [pools]);

  const { tokenMap } = useTokenInfos(allTokenAddrs);

  const { writeContractAsync } = useWriteContract();

  const handleAddPool = async () => {
    setAddPoolError('');
    if (fee === undefined) return;
    if (!amountIn || !amountOut) {
      setAddPoolError('Please enter both amounts');
      return;
    }
    if (!lowPrice || !highPrice) {
      setAddPoolError('Please enter low and high price');
      return;
    }
    if (!currentPrice) {
      setAddPoolError('Please enter current price');
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
            fee: Number(fee),
            tickLower: priceToTick(lowPrice),
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

  //用一个 state 统一管理"哪个输入框正在选 token"
  const [selecting, setSelecting] = useState<Selecting>();
  const selectedToken =
    selecting === Selecting.In ? tokenIn : selecting === Selecting.Out ? tokenOut : undefined;

  // tokens 弹窗选中 token 时触发
  // 如果选中的是另一边的 token，自动交换。（也可传disabledAddresses，禁选另一边的token）
  const handleSelectToken = (token: TokenInfo) => {
    if (selecting === Selecting.In) {
      //如： 用户在 In 选了 XRP，但 Out 已经是 XRP，就把 Out 设为旧的 In（ETH），变成"交换两边"
      if (token.address.toLowerCase() === tokenOut.address.toLowerCase()) {
        setTokenOut(tokenIn);
      }
      setTokenIn(token);
    } else if (selecting === Selecting.Out) {
      if (token.address.toLowerCase() === tokenIn.address.toLowerCase()) {
        setTokenIn(tokenOut);
      }
      setTokenOut(token);
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
                  if (!isConnected || !isChainidMatch) {
                    alert('Please connect your wallet to Sepolia network');
                    return;
                  }
                  setOpenAddPool(true);
                }}
              >
                Add Pool
              </button>

              <Modal
                isOpen={openAddPool}
                onClose={() => setOpenAddPool(false)}
                title="Add Pool"
                footer={
                  <ModalFooter
                    onClose={() => setOpenAddPool(false)}
                    handleAddClick={handleAddPool}
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
                  tokens={TOKEN_LIST}
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
            </>
          }
          columns={columns}
          data={pools as Pool[] | undefined}
          loading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};
