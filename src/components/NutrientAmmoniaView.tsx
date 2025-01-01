// src/renderer/components/NutrientAmmoniaView/NutrientAmmoniaView.tsx

import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import {ProcessedNutrientAmmoniaData} from "@/lib/types";

interface NutrientAmmoniaViewProps {
  data: ProcessedNutrientAmmoniaData[];
}

const NutrientAmmoniaView: React.FC<NutrientAmmoniaViewProps> = ({ data }) => {
  const { ammonia, ammonium } = data[0];
  console.log(data);
  return (
    <Box sx={{ padding: 3 }}>
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
              {ammonia.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="subtitle1" color="textSecondary">
              Ammonium Value (NH₄⁺) μmol/L
            </Typography>
            <Typography variant="h5" color="primary">
              {ammonium.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NutrientAmmoniaView;
