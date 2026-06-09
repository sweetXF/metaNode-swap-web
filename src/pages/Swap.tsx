import { useState } from 'react';
import { AmountInput, type TokenInfo } from '../components/AmountInput';
import { TokenList } from '../components/TokenList';

// 临时硬编码 token（后续应该从 token 列表取）
const TOKEN_LIST: TokenInfo[] = [
  { address: '0x4798388e3adE569570Df626040F07DF71135C48E', symbol: 'MNTA' },
  { address: '0x86B5bd6FFf459854ca91318274E47F4eEE245CF28', symbol: 'XRP' },
  { address: '0x86B5bd6FFf459854ca91318274E47F4eEGH45SV23', symbol: 'ETH' },
  // 后续可加更多
];

enum Selecting {
  In,
  Out,
}

export const SwapPage = () => {
  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKEN_LIST[1]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');

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

  //  点击 Swap 按钮时触发
  const handleSwap = () => {
    console.log('swap', { tokenIn, tokenOut, amountIn });
    // TODO: 调 SwapRouter
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Swap</p>
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

          <button
            onClick={handleSwap}
            disabled={!amountIn || Number(amountIn) === 0}
            className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Swap
          </button>
        </div>
      </div>
    </div>
  );
};
