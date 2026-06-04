interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

export const Pagination = ({ 
    page, 
    pageSize, 
    total, 
    totalPages, 
    onPageChange, 
    onPageSizeChange 
}: PaginationProps) => {
    return (
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-gray-100 text-sm text-gray-600">
      <span>
        {total === 0
          ? "0 items"
          : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total} items`}
      </span>

      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ‹
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`dot-${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`w-8 h-8 flex items-center justify-center border rounded-md transition ${
              p === page
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ›
      </button>

      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="ml-1 h-8 px-2 border border-gray-200 rounded-md bg-white"
      >
        {[10, 20, 50].map((s) => (
          <option key={s} value={s}>
            {s} / page
          </option>
        ))}
      </select>
    </div>
    )
}

//生成页码序列（带省略号）
const getPageNumbers = (current: number, total: number): (number | "...")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
}