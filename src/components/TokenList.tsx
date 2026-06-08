import { shortAddress } from "../utils/format";
import type { TokenInfo } from "./AmountInput";
import { Modal } from "./Modal";

interface TokenListProps {
    tokens:TokenInfo[];
    open: boolean;
    onClose: () => void;
    onSelect: (token:TokenInfo) => void;// 选中 token 时触发
    selected?:TokenInfo;// 当前选中的 token （高亮且显示✓）
    disabledAddresses?:`0x${string}`[]; // 禁用的 token 地址列表
}

export const TokenList = ({
    tokens,
    open,
    onClose,
    onSelect,
    selected,
    disabledAddresses
}:TokenListProps) => {
    const handleSelect=(token:TokenInfo) => {
        if (disabledAddresses?.includes(token.address)) return;
        onSelect(token);
        onClose();
    };
    return (
        <Modal title="Select Token" isOpen={open} onClose={onClose}>
            <div className="space-y-1">
               {
               tokens.map((token)=>{
                const isSelected=selected?.address.toLowerCase() === token.address.toLowerCase();
                const isDisabled=disabledAddresses?.some((addr)=> addr.toLowerCase() === token.address.toLowerCase());
                return (
                    <button key={token.address} type="button" disabled={isDisabled}
                    onClick={() => handleSelect(token)}
                    className={`w-full flex items-center justify-between py-3 px-3 rounded-lg text-left transition
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900">{token.symbol ?? 'Token'}</div>
                            <div className="text-xs text-gray-500 truncate">{shortAddress(token.address,6,8)}</div>
                        </div>
                        {isSelected && <div className="text-sm text-blue-600">✓</div>}
                    </button>
                )
               }
                
               )
               }
            </div>
        </Modal>
    )
}