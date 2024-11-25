// src/renderer/components/DataTable/DataTable.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';

interface DataTableProps {
  data: any;
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <Typography>No data available</Typography>;
    }
    const headers = Object.keys(data[0]);
    return (
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <Box component="thead">
          <Box component="tr">
            {headers.map((key) => (
              <Box
                component="th"
                key={key}
                sx={{
                  border: '1px solid #ddd',
                  padding: 1,
                  textAlign: 'left',
                  backgroundColor: 'grey.200',
                }}
              >
                {key}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {data.map((item: any, index: number) => (
            <Box component="tr" key={index}>
              {headers.map((key) => (
                <Box
                  component="td"
                  key={key}
                  sx={{
                    border: '1px solid #ddd',
                    padding: 1,
                  }}
                >
                  {String(item[key])}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (typeof data === 'object' && data !== null) {
    return (
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <Box component="tbody">
          {Object.entries(data).map(([key, value], index) => (
            <Box component="tr" key={index}>
              <Box
                component="th"
                sx={{
                  border: '1px solid #ddd',
                  padding: 1,
                  textAlign: 'left',
                  backgroundColor: 'grey.200',
                }}
              >
                {key}
              </Box>
              <Box
                component="td"
                sx={{
                  border: '1px solid #ddd',
                  padding: 1,
                }}
              >
                {String(value)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return <Typography>{String(data)}</Typography>;
};

export default DataTable;
