import { useEffect, useRef, useState } from "react";
import { FEE_TIERS } from "../utils/price";

interface FeeProps {
    value?: number; // 当前选中的fee tier，默认为 3000
    onChange: (value: number) => void;
    disabled?: boolean; // 是否禁用
    placeholder?: string; // 占位符
}

export const FeeTierSelect = ({
    value=3000,
    onChange,
    disabled,
    placeholder = "Select fee tier"
}: FeeProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    // 点此組件的外部，关闭下拉面板
    useEffect(() => {
        if(!open) return;
        const handler = (e: MouseEvent) => {
            // 点击的地方 *不在* ref 绑定的元素内部，则关闭下拉面板
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        //监听整个页面的鼠标按下事件
        document.addEventListener("mousedown", handler);
        return () => {
            //清理函数：组件销毁 / open 变化时，移除监听事件
            document.removeEventListener("mousedown", handler);
        };
    }, [open]);

    const curFeeTier = FEE_TIERS.find((tier) => tier.value === value);
    
    return (
        <div ref={ref} className="relative">
            {/* 触发按钮 */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((open) => !open)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                <span className={curFeeTier ? "text-gray-900" : "text-gray-400"}>
                {curFeeTier?.label ?? placeholder}
                </span>
                {/* 下拉框箭头及动画 */}
                <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                fill="currentColor"
                viewBox="0 0 12 12"
                >
                <path d="M6 8L2 4h8z" />
                </svg>
            </button>

            {/* 下拉面板 */}
            {open && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                {FEE_TIERS.map((tier) => {
                    const activeFee = tier.value === value;
                    return (
                    <button
                        key={tier.value}
                        type="button"
                        onClick={() => {
                            onChange(tier.value);
                            setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition text-left
                            ${activeFee ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
                    >
                        <span className="font-medium">{tier.label}</span>
                        <span className="text-xs text-gray-400">{tier.desc}</span>
                    </button>
                    );
                })}
                </div>
            )}
    </div>
    )
}