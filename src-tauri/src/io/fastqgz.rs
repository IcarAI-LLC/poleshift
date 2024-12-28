// file: io/fastq_gz.rs

use std::fs::File;
use std::io::{self, BufRead, BufReader, Read};
use std::path::Path;

use flate2::read::MultiGzDecoder;
use rayon::prelude::*;

use super::{FastqError, FastqRecord, ParseError, Validate};

/// A reader specifically for gzipped FASTQ files.
///
/// This reader does:
/// 1. Open a gzipped FASTQ file.
/// 2. Read and parse four-line blocks into [`FastqRecord`].
/// 3. Validate each record (optional).
/// 4. Process records in parallel (optional).
pub struct FastqGzReader<R: Read> {
    reader: BufReader<MultiGzDecoder<R>>,
    current_line: String,
}

impl FastqGzReader<File> {
    /// Open a gz-compressed FASTQ file from a filesystem path.
    pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Self, io::Error> {
        let file = File::open(path)?;
        Ok(Self::new(file))
    }
}

impl<R: Read> FastqGzReader<R> {
    /// Create a new `FastqGzReader` from any type that implements `Read`.
    /// This constructor wraps the underlying stream in a gzip decoder
    /// (`MultiGzDecoder`), then buffers it (`BufReader`).
    pub fn new(inner: R) -> Self {
        let gz = MultiGzDecoder::new(inner);
        Self {
            reader: BufReader::new(gz),
            current_line: String::new(),
        }
    }

    /// Read the next line from the gzipped FASTQ, returning `Ok(Some(line))`
    /// if successful, `Ok(None)` if EOF is reached, or an error otherwise.
    fn read_next_line(&mut self) -> Result<Option<String>, io::Error> {
        self.current_line.clear();
        let n = self.reader.read_line(&mut self.current_line)?;

        match n {
            0 => Ok(None), // EOF
            _ => {
                let trimmed = self.current_line.trim_end().to_string();
                Ok(Some(trimmed))
            }
        }
    }

    /// Collect all FASTQ records in the gzipped file. Each record is four lines:
    /// 1) Header (starting with '@')
    /// 2) Sequence
    /// 3) Plus line (starting with '+')
    /// 4) Quality scores
    ///
    /// Returns a vector of [`FastqRecord`] if successfully parsed.
    ///
    /// # Errors
    ///
    /// Returns a `ParseError` if:
    /// - The header line does not start with '@'
    /// - Any line is missing (truncated file)
    /// - The quality line is missing
    pub fn collect_records(&mut self) -> Result<Vec<FastqRecord>, ParseError> {
        let mut records = Vec::new();

        loop {
            // 1) Read header line. Must begin with '@'
            let header_line = match self.read_next_line()? {
                Some(line) if line.starts_with('@') => {
                    // skip the '@' character and store the rest
                    line[0..].to_string()
                }
                Some(_) => return Err(ParseError::Fastq(FastqError::MissingHeader)),
                None => break, // EOF encountered
            };

            // 2) Read sequence line
            let seq_line = match self.read_next_line()? {
                Some(line) => line,
                None => return Err(ParseError::Fastq(FastqError::MissingSequence)),
            };

            // 3) Read plus line (must begin with '+')
            match self.read_next_line()? {
                Some(line) if line.starts_with('+') => (),
                Some(_) | None => return Err(ParseError::Fastq(FastqError::MissingQuality)),
            }

            // 4) Read quality line
            let qual_line = match self.read_next_line()? {
                Some(line) => line,
                None => return Err(ParseError::Fastq(FastqError::MissingQuality)),
            };

            let record = FastqRecord {
                header: header_line,
                sequence: seq_line,
                // Convert quality ASCII string into raw bytes
                quality: qual_line.into_bytes(),
            };

            records.push(record);
        }

        Ok(records)
    }

    /// Validate all records in the gzipped FASTQ file in parallel.
    /// This checks that each record has the same length for sequence and quality,
    /// among other potential validations (as defined by the `Validate` trait).
    pub fn validate_parallel(&mut self) -> Result<(), ParseError> {
        let records = self.collect_records()?;

        records
            .par_iter()
            .try_for_each(|record| record.validate().map_err(ParseError::Fastq))
    }

    /// Process all records in parallel with a user-supplied function `f`.
    ///
    /// # Returns
    ///
    /// A `Vec<T>` where `T` is the result of applying `f` to each record.
    ///
    /// # Errors
    ///
    /// Returns a `ParseError` if any record fails validation.
    pub fn process_parallel<F, T>(&mut self, f: F) -> Result<Vec<T>, ParseError>
    where
        F: Fn(&FastqRecord) -> T + Send + Sync,
        T: Send,
    {
        let records = self.collect_records()?;

        // Validate first, in parallel
        records
            .par_iter()
            .try_for_each(|rec| rec.validate().map_err(ParseError::Fastq))?;

        // Apply the user function `f` in parallel
        let results = records.par_iter().map(f).collect();

        Ok(results)
    }

    /// Calculate quality statistics (min, max, average) across all records in parallel.
    ///
    /// # Errors
    ///
    /// Returns a `ParseError` if there is a problem reading or validating records.
    pub fn quality_stats(&mut self) -> Result<QualityStats, ParseError> {
        let records = self.collect_records()?;

        // Validate records first
        records
            .par_iter()
            .try_for_each(|rec| rec.validate().map_err(ParseError::Fastq))?;

        // Compute per-record stats
        let per_record_stats: Vec<QualityStats> = records
            .par_iter()
            .map(|rec| {
                if rec.quality.is_empty() {
                    return QualityStats {
                        min: 0,
                        max: 0,
                        avg: 0.0,
                        count: 0,
                    };
                }

                let min_q = *rec.quality.iter().min().unwrap();
                let max_q = *rec.quality.iter().max().unwrap();
                let sum_q: u32 = rec.quality.iter().map(|&b| b as u32).sum();
                let count = rec.quality.len();

                QualityStats {
                    min: min_q,
                    max: max_q,
                    avg: sum_q as f64 / count as f64,
                    count,
                }
            })
            .collect();

        // Combine stats
        Ok(QualityStats::combine(&per_record_stats))
    }
}

/// Aggregated statistics over quality scores.
#[derive(Debug, Clone)]
pub struct QualityStats {
    pub min: u8,
    pub max: u8,
    pub avg: f64,
    pub count: usize,
}

impl QualityStats {
    /// Combine an array of `QualityStats` into one aggregate.
    pub fn combine(stats: &[QualityStats]) -> Self {
        if stats.is_empty() {
            return Self {
                min: 0,
                max: 0,
                avg: 0.0,
                count: 0,
            };
        }

        let total_count: usize = stats.iter().map(|s| s.count).sum();
        if total_count == 0 {
            // All records had empty quality lines
            return Self {
                min: 0,
                max: 0,
                avg: 0.0,
                count: 0,
            };
        }

        let min_quality = stats.iter().map(|s| s.min).min().unwrap();
        let max_quality = stats.iter().map(|s| s.max).max().unwrap();

        // Weighted average: (sum of (avg_i * count_i)) / total_count
        let weighted_avg: f64 = stats
            .iter()
            .map(|s| s.avg * (s.count as f64))
            .sum::<f64>()
            / (total_count as f64);

        Self {
            min: min_quality,
            max: max_quality,
            avg: weighted_avg,
            count: total_count,
        }
    }
}
