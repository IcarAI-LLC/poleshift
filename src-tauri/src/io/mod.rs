use thiserror::Error;

pub mod fastq;
pub mod fastqgz;

pub use fastq::FastqReader;
pub use fastqgz::FastqGzReader;

#[derive(Debug, Clone, PartialEq)]
pub struct FastqRecord {
    pub header: String,
    pub sequence: String,
    pub quality: Vec<u8>,
}

#[derive(Error, Debug)]
pub enum FastqError {
    #[error("Invalid quality score")]
    InvalidQualityScore,
    #[error("Quality length does not match sequence length")]
    QualityMismatch,
    #[error("Missing FASTQ header")]
    MissingHeader,
    #[error("Missing FASTQ sequence")]
    MissingSequence,
    #[error("Missing FASTQ quality scores")]
    MissingQuality,
}

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("FASTQ error: {0}")]
    Fastq(#[from] FastqError),
    #[error("Invalid file format")]
    InvalidFormat,
}
pub trait Validate {
    type Error;

    /// Validates the record structure and contents
    fn validate(&self) -> Result<(), Self::Error>;
}

impl Validate for FastqRecord {
    type Error = FastqError;

    fn validate(&self) -> Result<(), Self::Error> {
        // Validate header
        if self.header.is_empty() {
            return Err(FastqError::MissingHeader);
        }

        // Validate sequence
        if self.sequence.is_empty() {
            return Err(FastqError::MissingSequence);
        }

        // Validate quality scores
        if self.quality.is_empty() {
            return Err(FastqError::MissingQuality);
        }

        // Check if quality length matches sequence length
        if self.quality.len() != self.sequence.len() {
            return Err(FastqError::QualityMismatch);
        }

        // Validate quality scores (typically Phred+33 encoded, range 33-126)
        if self.quality.iter().any(|&q| q < 33 || q > 126) {
            return Err(FastqError::InvalidQualityScore);
        }

        Ok(())
    }
}
