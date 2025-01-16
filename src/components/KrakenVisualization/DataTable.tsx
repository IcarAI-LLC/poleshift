
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {useState} from "react"; // Adjust path as needed

interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  onSort?: (key: string, direction: "asc" | "desc") => void;
}

export default function DataTable({ data, columns, onSort }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  return (
      <div className="mt-2 w-full overflow-auto rounded border">
        <Table>
          {/* Sticky header */}
          <TableHeader className="sticky top-0 z-10 bg-background">
            {/*
            We remove the row-level hover by:
              1) pointer-events-none and hover:bg-transparent on the row
              2) pointer-events-auto on the button so the button is still clickable
          */}
            <TableRow className="pointer-events-none hover:bg-transparent">
              {columns.map((column) => {
                const isActiveSort = sortConfig?.key === column.key;
                const currentDirection = isActiveSort ? sortConfig?.direction : "asc";

                return (
                    <TableHead key={column.key} className="whitespace-nowrap">
                      {column.sortable ? (
                          <button
                              onClick={() => handleSort(column.key)}
                              // Make sure the button can still receive clicks
                              className="
                        pointer-events-auto
                        flex items-center gap-1 rounded-md
                        bg-muted/30 px-2 py-1 text-sm font-medium
                        hover:bg-muted/50 focus:outline-none
                      "
                          >
                            {column.header}
                            {isActiveSort && (
                                <span>{currentDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </button>
                      ) : (
                          <span className="text-sm font-medium">{column.header}</span>
                      )}
                    </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center">
                    No data available
                  </TableCell>
                </TableRow>
            ) : (
                data.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {columns.map((column) => {
                        const cellValue = row[column.key];
                        return (
                            <TableCell key={column.key}>
                              {column.render
                                  ? column.render(cellValue, row)
                                  : cellValue}
                            </TableCell>
                        );
                      })}
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
  );
}
