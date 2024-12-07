// src/renderer/components/NutrientAmmoniaView/NutrientAmmoniaView.tsx

import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';

/**
 * NutrientAmmoniaData is an interface that represents data related to ammonia
 * that includes both ammonia (NH3) and ammonium (NH4+) values.
 *
 * This interface is typically used in scenarios where it is important to
 * parse, store, or manipulate data regarding nutrient levels of ammonia
 * and ammonium in a given sample or environment, often for agricultural,
 * environmental, or laboratory analysis purposes.
 *
 * Properties:
 * @property {number} ammonia_value - Represents the concentration of ammonia
 *   (NH3) measured in a sample. This value could be in units such as mg/L
 *   or ppm, depending on the context in which this data is used.
 *
 * @property {number} ammonium_value - Represents the concentration of ammonium
 *   (NH4+) in a sample. Like the ammonia_value, this is measured in units such
 *   as mg/L or ppm.
 */
interface NutrientAmmoniaData {
  ammonia_value: number;
  ammonium_value: number;
}

/**
 * Represents the properties for the Nutrient Ammonia view component.
 *
 * This interface defines the structure of the properties required
 * by a component responsible for displaying information about nutrient ammonia.
 *
 * @interface NutrientAmmoniaViewProps
 *
 * @property {NutrientAmmoniaData[]} data - An array of NutrientAmmoniaData objects that contain
 * information related to nutrient ammonia. This data is used to render the view accurately
 * according to the provided information.
 */
interface NutrientAmmoniaViewProps {
  data: NutrientAmmoniaData[];
}

/**
 * A React functional component that displays nutrient ammonia details.
 * This component takes in data as a prop and renders the ammonia value
 * in milligrams per liter and the ammonium value in micromoles per liter.
 *
 * @component
 * @param {Object} props - The component's props.
 * @param {Object[]} props.data - An array of data objects.
 * @param {number} props.data[].ammonia_value - The ammonia value in mg/L.
 * @param {number} props.data[].ammonium_value - The ammonium value in μmol/L.
 * @returns {JSX.Element} The rendered component for displaying nutrient ammonia details.
 */
const NutrientAmmoniaView: React.FC<NutrientAmmoniaViewProps> = ({ data }) => {
  //@ts-ignore
  const { ammonia_value, ammonium_value } = data;
  console.log(data);
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
