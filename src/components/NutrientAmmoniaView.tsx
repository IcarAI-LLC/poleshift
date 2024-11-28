// src/renderer/components/NutrientAmmoniaView/NutrientAmmoniaView.tsx

import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';

interface NutrientAmmoniaData {
  ammonia_value: number;
  ammonium_value: number;
}

interface NutrientAmmoniaViewProps {
  data: NutrientAmmoniaData[];
}

const NutrientAmmoniaView: React.FC<NutrientAmmoniaViewProps> = ({ data }) => {
  const { ammonia_value, ammonium_value } = data[0];

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        Nutrient Ammonia Details
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Ammonia Value (NH₃) mg/L
            </Typography>
            <Typography variant="h5" color="primary">
              {ammonia_value.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Ammonium Value (NH₄⁺) μmol/L
            </Typography>
            <Typography variant="h5" color="primary">
              {ammonium_value.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NutrientAmmoniaView;
