// 单个数值输入框
interface CellInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: number;
  disabled?: boolean;
  unit?: string;
  isAdjust?: boolean;
  endText?: string;
}

export const CellInput = ({
  value,
  onChange,
  placeholder = '0',
  step = 1,
  disabled,
  unit,
  isAdjust=true,
  endText=''
}: CellInputProps) => {
  const formatDecimal = (val: string): string => {
    return val
      .replace(/[^\d.]/g, '') // 清除非数字、小数点以外字符
      .replace(/^\./, '') // 禁止小数点在开头
      .replace(/(\.)(?=.*\1)/g, ''); // 最多一个小数点
  };

  // 调整值(步进加减)
  const adjust = (step: number) => {
    const curValue = Number(value) || 0;
    const nextValue = curValue + step;
    if (nextValue < 0) return; // 价格不能为负数
    onChange(nextValue.toString());
  };

  return (
    <div>
      <div
        className={`flex items-center bg-white border border-gray-200 rounded-md overflow-hidden focus-within:border-blue-500 transition ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(formatDecimal(e.target.value))}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />

        {/* 上下小箭头 */}
        {isAdjust && (
        <div className="flex flex-col border-l border-gray-200">
          <button
            type="button"
            onClick={() => adjust(step)}
            disabled={disabled}
            className="px-1.5 h-1/2 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed transition"
            tabIndex={-1}
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 12 12">
              <path d="M6 3l4 6H2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => adjust(-step)}
            disabled={disabled}
            className="px-1.5 h-1/2 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed transition border-t border-gray-200"
            tabIndex={-1}
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 12 12">
              <path d="M6 9L2 3h8z" />
            </svg>
          </button>
        </div>
          )}

{/* 输入框右侧文本 */}
             {endText && (
        <div className="flex flex-col border-l border-gray-200">
         <span className="px-1.5 h-1/2 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed transition">{endText}
        </span>
        </div>
          )}
      </div>

      {/* 输入框下方文案 */}
      {unit && <p className="mt-1 text-xs text-gray-400">{unit}</p>}
    </div>
  );
};
