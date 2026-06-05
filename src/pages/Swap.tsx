import { useState } from "react";
import { AmountInput, type TokenInfo } from "../components/AmountInput"

// 临时硬编码 token（后续应该从 token 列表取）
const ETH: TokenInfo = {
    address: "0x4798388e3adE569570Df626040F07DF71135C48E",
    symbol: "ETH",
  };
  const XRP: TokenInfo = {
    address: "0x86B5bd6FFf459854ca91318274E47F4eEE245CF28",
    symbol: "XRP",
  };

export const SwapPage = () => {
    const [tokenIn, setTokenIn] = useState<TokenInfo>(ETH);
    const [tokenOut, setTokenOut] = useState<TokenInfo>(XRP);
    const [amountIn, setAmountIn] = useState("");
    const [amountOut, setAmountOut] = useState("");

  const handleSwap = () => {
    console.log("swap", { tokenIn, tokenOut, amountIn });
    // TODO: 调 SwapRouter.exactInputSingle
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
                        onTokenSelect={() => console.log("open token list (in)")}
                        showMax
                        />

                        <AmountInput
                        token={tokenOut}
                        amount={amountOut}
                        onAmountChange={setAmountOut}
                        onTokenSelect={() => console.log("open token list (out)")}
                        // readOnly
                        />
                    </div>

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
    )
}