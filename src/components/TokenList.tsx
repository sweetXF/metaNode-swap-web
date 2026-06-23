import { useEffect, useMemo, useRef, useState } from 'react';
import type { TokenInfo } from '../config/types';
import { shortAddress } from '../utils/format';
import { Modal } from './Modal';

interface TokenListProps {
  tokens: TokenInfo[];
  open: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void; // 选中 token 时触发
  selected?: TokenInfo; // 当前选中的 token （高亮且显示✓）
  disabledAddresses?: `0x${string}`[]; // 禁用的 token 地址列表
  isSearch?: boolean; // 是否带搜索框
}

export const TokenList = ({
  tokens,
  open,
  onClose,
  onSelect,
  selected,
  disabledAddresses,
  isSearch = true,
}: TokenListProps) => {
  const handleSelect = (token: TokenInfo) => {
    if (disabledAddresses?.includes(token.address)) return;
    onSelect(token);
    onClose();
  };

  const [keyword, setKeyword] = useState(''); //输入实时值
  const [searchValue, setSearchValue] = useState(''); //防抖后的最终值

  // 搜索框 防抖
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSearchValue(keyword.trim());
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword]);

  const handleClear = () => {
    setKeyword('');
  };

  // 关闭弹窗时清空搜索
  useEffect(() => {
    if (!open) {
      setKeyword('');
      setSearchValue('');
    }
  }, [open]);

  // 根据防抖后的搜索值过滤 token 列表（symbol 或 address 匹配，忽略大小写）
  const filteredTokens = useMemo(() => {
    if (!searchValue) return tokens;
    const sv = searchValue.toLowerCase();
    return tokens.filter(
      token => token.symbol?.toLowerCase().includes(sv) || token.address.toLowerCase().includes(sv)
    );
  }, [tokens, searchValue]);

  return (
    <Modal title="Select Token" isOpen={open} onClose={onClose}>
      {/* 搜索框 */}
      {isSearch ? (
        <div className="w-full max-w-md mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="输入 token 名称或地址搜索..."
              className="w-full pl-10 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition"
            />
            {/* 清除按钮：有文字才显示 */}
            {keyword && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* token列表 */}
      <div className="space-y-1">
        {filteredTokens.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">无匹配的 token</div>
        ) : (
          filteredTokens.map(token => {
            const isSelected = selected?.address === token.address;
            const isDisabled = disabledAddresses?.some(addr => addr === token.address);
            return (
              <button
                key={token.address}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelect(token)}
                className={`w-full flex items-center justify-between py-3 px-3 rounded-lg text-left transition
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'}
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{token.symbol ?? 'Token'}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {shortAddress(token.address, 6, 8)}
                  </div>
                </div>
                {isSelected && <div className="text-sm text-blue-600">✓</div>}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
};
