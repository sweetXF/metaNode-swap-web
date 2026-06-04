import { useMemo, useState, type ReactNode } from "react";
import { Pagination } from "./Pagination";

//列
export interface Column<T> {
    key:string; //唯一 key
    label:ReactNode; //表头文字
    render: (row: T, rowIndex: number) => ReactNode; //渲染当前行：传入整行数据，返回 cell 内容
    className?: string; //列宽（可选，传 className）
}

interface DataTalbeProps<T> {
    title: ReactNode; //卡片标题，例如 "Pool list" / "My Positions"
    extra?: ReactNode; //卡片头部右侧操作区，例如 "Add Pool" / "My Positions" 按钮组
    columns: Column<T>[]; //列配置
    data: T[] | undefined; //数据
    loading?: boolean;
    error?: Error | null;
    defaultPageSize?: number; //默认每页条数
    rowKey?: (row : T,index:number)=>string | number; //行 key
}

export const DataTable = <T extends object>({
    title,
    extra,
    columns,
    data,
    loading,
    error,
    defaultPageSize=10,
    rowKey
}: DataTalbeProps<T>) => {
    const [page,setPage] = useState(1);//当前页
    const [pageSize,setPageSize] = useState(defaultPageSize);//每页条数

    const total = data?.length ?? 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    if(page>totalPages) setPage(totalPages); //如果页码超过总页数，重置为最后一页

    //分页数据
    const pagedData = useMemo(() => {
        if(!data) return [];
        const start = (page - 1) * pageSize;
        return data.slice(start,start + pageSize);
    },[data,page,pageSize])

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 卡片头 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-800">{title}</h2>
          {extra && <div className="flex items-center gap-2">{extra}</div>}
        </div>
  
        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-center font-medium ${col.className ?? ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-red-500">
                    {error.message}
                  </td>
                </tr>
              )}
              {!loading && !error && pagedData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                    No data
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pagedData.map((row, i) => {
                  const key = rowKey ? rowKey(row, i) : i;
                  return (
                    <tr key={key} className="hover:bg-gray-50 transition">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-6 py-4 text-gray-700 ${col.className ?? ""}`}
                        >
                          {col.render(row, i)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 分页器 */}
        <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
        }}
      />
        
        </div>
    )
}