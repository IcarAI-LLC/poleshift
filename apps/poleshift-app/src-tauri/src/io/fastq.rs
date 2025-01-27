// io/fastq.rs
use super::{FastqError, FastqRecord, ParseError};
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
}