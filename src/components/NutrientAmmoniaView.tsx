// src/renderer/components/NutrientAmmoniaView/NutrientAmmoniaView.tsx

import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';

interface NutrientAmmoniaData {
  ammoniaValue: number;
  ammoniumValue: number;
}

interface NutrientAmmoniaViewProps {
  data: NutrientAmmoniaData;
}

const NutrientAmmoniaView: React.FC<NutrientAmmoniaViewProps> = ({ data }) => {
  const { ammoniaValue, ammoniumValue } = data;

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
              {ammoniaValue.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Ammonium Value (NH₄⁺) μmol/L
            </Typography>
            <Typography variant="h5" color="primary">
              {ammoniumValue.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NutrientAmmoniaView;
