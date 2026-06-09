import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { DataTable, type Column } from '../components/DataTable';
import { getContractAddress } from '../config/contracts';
import { positionAbi } from '../abi/PositionManager';
import { shortAddress } from '../utils/format';
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from '../utils/price';
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { ModalFooter } from '../components/ModalFooter';
import { AmountInput, type TokenInfo } from '../components/AmountInput';
import { FeeTierSelect } from '../components/FeeTierSelect';
import { TokenList } from '../components/TokenList';

type Position = {
  fee: number;
  feeGrowthInside0LastX128: bigint; //上次提取手续费时的 feeGrowthGlobal0X128
  feeGrowthInside1LastX128: bigint; // 上次提取手续费时的 feeGrowthGlobal1X128
  id: bigint; // 仓位编号 positionId
  index: number; // 位置编号,属于哪个 pool
  liquidity: bigint; // 该 Position 拥有的流动性
  owner: `0x${string}`; // 拥有者（具体用户）
  tickLower: number; // 用户主动选择的窄区间
  tickUpper: number;
  token0: `0x${string}`;
  token1: `0x${string}`;
  tokensOwed0: bigint; // 可提取的 token0 数量
  tokensOwed1: bigint; // 可提取的 token1 数量
};

enum Selecting {
  In,
  Out,
}

// 临时硬编码 token（后续应该从 token 列表取）
const TOKEN_LIST: TokenInfo[] = [
  { address: '0x4798388e3adE569570Df626040F07DF71135C48E', symbol: 'MNTA' },
  { address: '0x86B5bd6FFf459854ca91318274E47F4eEE245CF28', symbol: 'XRP' },
  { address: '0x86B5bd6FFf459854ca91318274E47F4eEGH45SV23', symbol: 'ETH' },
  // 后续可加更多
];

export const PositionPage = () => {
  const chainId = useChainId(); // 项目wagmi配置的链 id
  const { isConnected, chainId: curChainId } = useAccount(); // 当前钱包连接状态
  const isChainidMatch = curChainId === chainId;

  const [openAddPosition, setOpenAddPosition] = useState(false);

  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKEN_LIST[1]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [fee, setFee] = useState<number>();

  const {
    data: positions,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: getContractAddress(chainId, 'PositionManager'),
    abi: positionAbi,
    functionName: 'getAllPositions',
    query: {
      enabled: isConnected && !!chainId && isChainidMatch,
    },
  });

  // isPending：等待用户在钱包确认。
  // txHash：交易已提交后的 tx 哈希。
  // error： 用户拒绝 / 模拟失败等错误
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  // 等待交易上链确认
  // isLoading：已发出但还未确认（等出块）
  // isSuccess： 交易已成功上链
  // isError： 交易失败 / 被回滚
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  // 交易确认后自动刷新列表
  useEffect(() => {
    if (isConfirmed) {
      refetch();
    }
  }, [isConfirmed, refetch]);

  const handleRemove = (row: Position) => {
    writeContract({
      address: getContractAddress(chainId, 'PositionManager'),
      abi: positionAbi,
      functionName: 'burn',
      args: [row.id],
    });

    console.log('remove position：', row);
    console.log('txhash isPending writeError：', txHash, isPending, writeError);
    console.log('isConfirming isSuccess isError：', isConfirming, isConfirmed, isError);
  };

  const handleCollect = (row: Position) => {
    console.log('collect position', row);
  };

  const handleAddPosition = () => {
    console.log('add position');
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

  const columns: Column<Position>[] = [
    {
      key: 'token',
      label: 'Token',
      render: row => `${shortAddress(row.token0)} / ${shortAddress(row.token1)}`,
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
    // {
    //     key:'price',
    //     label:'Current price',
    //     render:(row) => sqrtPriceX96ToPrice(row.sqrtPriceX96).toFixed(3),
    // },
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
      render: row => (
        <div className="flex items-center gap-2">
          <button
            disabled={isPending || isConfirming}
            className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleRemove(row)}
          >
            {isPending ? 'Pending...' : isConfirming ? 'Confirming...' : 'Remove'}
          </button>
          <button
            disabled={isPending || isConfirming}
            className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleCollect(row)}
          >
            Collect
          </button>
        </div>
      ),
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

        <DataTable<Position>
          title="My Positions"
          extra={
            <>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                onClick={() => setOpenAddPosition(true)}
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
                    handleAddClick={() => handleAddPosition()}
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
                <FeeTierSelect disabled={!tokenIn || !tokenOut} value={fee} onChange={setFee} />
              </Modal>
            </>
          }
          columns={columns}
          data={positions as Position[] | undefined}
          loading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};
