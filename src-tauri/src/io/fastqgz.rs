// file: io/fastq_gz.rs

use std::fs::File;
use std::io::{self, BufRead, BufReader, Read};
use flate2::read::MultiGzDecoder;
use super::{FastqError, FastqRecord, ParseError};

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
}