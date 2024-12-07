import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
} from '@mui/material';

interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}

const DataTable: React.FC<DataTableProps> = ({ data, columns, onSort }) => {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }

    setSortConfig({ key, direction });
    if (onSort) {
      onSort(key, direction);
    }
  };

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                sortDirection={
                  sortConfig?.key === column.key ? sortConfig.direction : false
                }
              >
                {column.sortable ? (
                  <TableSortLabel
                    active={sortConfig?.key === column.key}
                    direction={
                      sortConfig?.key === column.key
                        ? sortConfig.direction
                        : 'asc'
                    }
                    onClick={() => handleSort(column.key)}
                  >
                    {column.header}
                  </TableSortLabel>
                ) : (
                  column.header
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;
