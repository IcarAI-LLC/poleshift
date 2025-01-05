// io/fastq.rs
use super::{FastqError, FastqRecord, ParseError, Validate};
use rayon::prelude::*;
use std::io::{BufRead, BufReader, Read};

/// Reads FASTQ records from any source implementing the Read trait
pub struct FastqReader<R: Read> {
    reader: BufReader<R>,
    current_line: String,
}

impl<R: Read> FastqReader<R> {
    /// Creates a new FASTQ reader
    pub fn new(read: R) -> Self {
        FastqReader {
            reader: BufReader::new(read),
            current_line: String::new(),
        }
    }

    /// Reads next line, handling IO errors
    fn read_next_line(&mut self) -> Result<Option<String>, std::io::Error> {
        self.current_line.clear();
        match self.reader.read_line(&mut self.current_line) {
            Ok(0) => Ok(None),
            Ok(_) => Ok(Some(self.current_line.trim().to_string())),
            Err(e) => Err(e),
        }
    }

    /// Collects all records into a vector for parallel processing
    pub fn collect_records(&mut self) -> Result<Vec<FastqRecord>, ParseError> {
        let mut records = Vec::new();

        loop {
            // Read the four lines of a FASTQ record
            let header = match self.read_next_line()? {
                Some(line) if line.starts_with('@') => line[0..].to_string(),
                Some(_) => return Err(ParseError::Fastq(FastqError::MissingHeader)),
                None => break, // EOF
            };

            let sequence = match self.read_next_line()? {
                Some(line) => line,
                None => return Err(ParseError::Fastq(FastqError::MissingSequence)),
            };

            // Skip the + line but verify it exists
            match self.read_next_line()? {
                Some(line) if line.starts_with('+') => (),
                Some(_) => return Err(ParseError::Fastq(FastqError::MissingQuality)),
                None => return Err(ParseError::Fastq(FastqError::MissingQuality)),
            };

            let quality_string = match self.read_next_line()? {
                Some(line) => line,
                None => return Err(ParseError::Fastq(FastqError::MissingQuality)),
            };

            // Convert quality string to quality scores
            let quality: Vec<u8> = quality_string.as_bytes().to_vec();

            let record = FastqRecord {
                header,
                sequence,
                quality,
            };

            records.push(record);
        }

        Ok(records)
    }

    /// Process records in parallel with a custom function
    pub fn process_parallel<F, T>(&mut self, f: F) -> Result<Vec<T>, ParseError>
    where
        F: Fn(&FastqRecord) -> T + Send + Sync,
        T: Send,
    {
        let records = self.collect_records()?;

        // Validate records in parallel
        if let Err(e) = records
            .par_iter()
            .try_for_each(|record| record.validate().map_err(ParseError::Fastq))
        {
            return Err(e);
        }

        // Process valid records in parallel
        Ok(records.par_iter().map(f).collect())
    }

    /// Validate all records in parallel
    pub fn validate_parallel(&mut self) -> Result<(), ParseError> {
        let records = self.collect_records()?;

        records
            .par_iter()
            .try_for_each(|record| record.validate().map_err(ParseError::Fastq))
    }

    /// Calculate quality score statistics in parallel
    pub fn quality_stats(&mut self) -> Result<QualityStats, ParseError> {
        let records = self.collect_records()?;

        // Validate first
        records
            .par_iter()
            .try_for_each(|record| record.validate().map_err(ParseError::Fastq))?;

        // Calculate stats in parallel
        let stats: Vec<QualityStats> = records
            .par_iter()
            .map(|record| {
                let scores = &record.quality;
                let sum: u32 = scores.iter().map(|&x| x as u32).sum();
                let min = *scores.iter().min().unwrap_or(&0);
                let max = *scores.iter().max().unwrap_or(&0);

                QualityStats {
                    min,
                    max,
                    avg: sum as f64 / scores.len() as f64,
                    count: scores.len(),
                }
            })
            .collect();

        // Combine all stats
        Ok(QualityStats::combine(&stats))
    }
}

#[derive(Debug, Clone)]
pub struct QualityStats {
    pub min: u8,
    pub max: u8,
    pub avg: f64,
    pub count: usize,
}

impl QualityStats {
    fn combine(stats: &[QualityStats]) -> Self {
        if stats.is_empty() {
            return QualityStats {
                min: 0,
                max: 0,
                avg: 0.0,
                count: 0,
            };
        }

        let min = stats.iter().map(|s| s.min).min().unwrap();
        let max = stats.iter().map(|s| s.max).max().unwrap();
        let total_count: usize = stats.iter().map(|s| s.count).sum();
        let weighted_avg: f64 =
            stats.iter().map(|s| s.avg * s.count as f64).sum::<f64>() / total_count as f64;

        QualityStats {
            min,
            max,
            avg: weighted_avg,
            count: total_count,
        }
    }
}
