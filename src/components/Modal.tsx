import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom"

interface ModalProps {
    title?: ReactNode;
    children: ReactNode;
    footer?: ReactNode; // 	底部按钮区
    maskClose?: boolean; // 点遮罩关闭
    hideCloseIcon?: boolean; // 隐藏右上角 ✕
    escClose?: boolean; // 按 Esc 关闭
    width?: number; //弹窗宽度
    isOpen: boolean;
    onClose: () => void; // 关闭弹窗（点 X、遮罩，按 Esc 触发）
}

export const Modal = (
    {
        title,
        children,
        footer, 
        maskClose=true, 
        hideCloseIcon=false, 
        escClose=true,
        width=400,
        isOpen,
        onClose 	
    } : ModalProps
) => {

    // 按 Esc 关闭
    useEffect(() => {
        if(!open || !escClose) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEsc);
        return () => {
            window.removeEventListener("keydown", handleEsc);
        };
    },[isOpen,escClose,onClose])

    // 打开时禁止 body 滚动
    useEffect(() => {
        if(!isOpen) return;
        const orialOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = orialOverflow;
        };
    },[isOpen])

    if(!isOpen) return null;

    // createPortal(要渲染的内容, 目标DOM节点)
    return createPortal(
        // 遮罩层
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => maskClose && onClose()}
        >
          {/* 弹窗卡片：阻止点击冒泡到遮罩 */}
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
            style={{ width }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            {(title || !hideCloseIcon) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                {!hideCloseIcon && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition w-6 h-6 flex items-center justify-center"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
    
            {/* 主体内容（可滚动） */}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    
            {/* 底部 */}
            {footer && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </div>
        </div>,
        document.body
    )
}