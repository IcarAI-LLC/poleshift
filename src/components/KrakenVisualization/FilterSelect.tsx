import React from 'react';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  // eslint-disable-next-line react/require-default-props
  label?: string;
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  label,
}) => (
  <FormControl variant="outlined" fullWidth>
    {label && <InputLabel id="rank-select-label">{label}</InputLabel>}
    <Select
      labelId="rank-select-label"
      value={value}
      onChange={(e) => onChange(e.target.value as string)}
      label={label}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export default FilterSelect;
