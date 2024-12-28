use regex::Regex;
use uuid::Uuid;
use crate::krakenuniq::ProcessedKrakenUniqReport;

pub fn parse_kraken_uniq_report(
    report_content: &str,
    processed_data_id: &str,
    user_id: &str,
    org_id: &str,
    sample_id: &str,
) -> Result<Vec<ProcessedKrakenUniqReport>, String> {
    // 1) Split lines, remove empty lines
    let lines: Vec<&str> = report_content
        .lines()
        .map(|l| l.trim_end())
        .filter(|l| !l.is_empty())
        .collect();

    // 2) If fewer than 2 lines, there's no data (or just header).
    if lines.len() < 2 {
        return Ok(vec![]);
    }

    // 3) Skip the header
    let data_lines = &lines[1..];

    // 4) (Optional) If the first data line might be "unclassified," handle it
    let re_unclassified = Regex::new(r"^(\d+\.\d+)\t(\d+)\t(\d+)\t.*unclassified$")
        .map_err(|e| e.to_string())?;

    // 5) Regex to capture indentation
    let re_indent = Regex::new(r"^(\s*)(\S.*)$").map_err(|e| e.to_string())?;

    // Temporary node with e_score
    #[derive(Debug)]
    struct TempNode {
        id: String,
        depth: usize,
        percentage: f64,
        reads: String,
        tax_reads: String,
        kmers: String,
        duplication: String,
        coverage: String,
        tax_id: u64,
        rank: String,
        tax_name: String,
        e_score: f64, // <-- new field
    }

    let mut temp_nodes: Vec<TempNode> = Vec::new();

    for line in data_lines {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 9 {
            continue;
        }

        let percentage_str = cols[0];
        let reads_str = cols[1];
        let tax_reads_str = cols[2];
        let kmers_str = cols[3];
        let dup_str = cols[4];
        let cov_str = cols[5];
        let tax_id_str = cols[6];
        let rank_str = cols[7];
        let tax_name_with_indent = cols[8];

        if let Some(caps) = re_indent.captures(tax_name_with_indent) {
            let indent_str = caps.get(1).map_or("", |m| m.as_str());
            let tax_name_str = caps.get(2).map_or("", |m| m.as_str());

            let depth = indent_str.len() / 2; // each 2 spaces => 1 depth level
            let rank_upper = rank_str.trim().to_uppercase();

            // Convert coverage = "NA" to a sentinel like -999
            let coverage_str = if cov_str.eq_ignore_ascii_case("NA") {
                "-999".to_string()
            } else {
                cov_str.to_string()
            };

            // Filter out "RANK" if needed
            if rank_upper == "RANK" {
                continue;
            }

            // If unclassified, you might label it that way
            let rank = if tax_name_str.to_lowercase().contains("unclassified") {
                "UNCLASSIFIED".to_string()
            } else {
                rank_upper
            };

            let row_id = Uuid::new_v4().to_string();
            let percentage = percentage_str.parse::<f64>().unwrap_or(0.0);
            let tax_id = tax_id_str.parse::<u64>().unwrap_or(0);

            // Parse numeric fields safely
            let tax_reads_f = tax_reads_str.parse::<f64>().unwrap_or(0.0);
            let kmers_f = kmers_str.parse::<f64>().unwrap_or(0.0);
            let coverage_f = coverage_str.parse::<f64>().unwrap_or(-999.0);

            // Now compute e_score as requested:
            // E = (kmers / tax_reads) * exp( exp( coverage ) )
            // Handle edge cases: if tax_reads == 0 or coverage < 0 => e_score = 0
            let e_score = if tax_reads_f == 0.0 || coverage_f < 0.0 {
                0.0
            } else {
                (kmers_f / tax_reads_f) * (coverage_f.exp().exp())
            };

            temp_nodes.push(TempNode {
                id: row_id,
                depth,
                percentage,
                reads: reads_str.into(),
                tax_reads: tax_reads_str.into(),
                kmers: kmers_str.into(),
                duplication: dup_str.into(),
                coverage: coverage_str,
                tax_id,
                rank,
                tax_name: tax_name_str.trim().to_string(),
                e_score,
            });
        }
    }

    // -- Build parent/child relationships --
    let len = temp_nodes.len();
    let mut parents: Vec<Option<usize>> = vec![None; len];
    let mut children: Vec<Vec<usize>> = vec![Vec::new(); len];

    // We'll track the top node at each depth in a stack
    let mut stack: Vec<Option<usize>> = vec![None; 50];

    for i in 0..len {
        let d = temp_nodes[i].depth;

        if d > 0 {
            // parent is top of stack at depth d-1
            if let Some(parent_idx) = stack[d - 1] {
                parents[i] = Some(parent_idx);
                children[parent_idx].push(i);
            }
        }
        // put self on top of stack at depth d
        stack[d] = Some(i);

        // clear deeper stack entries
        for deeper in (d + 1)..stack.len() {
            stack[deeper] = None;
        }
    }

    // -- Build final results --
    let mut results = Vec::new();
    for i in 0..len {
        let node = &temp_nodes[i];

        let parent_id = parents[i].map(|p_idx| temp_nodes[p_idx].id.clone());
        let children_ids_vec = &children[i];
        let children_ids_str = if children_ids_vec.is_empty() {
            None
        } else {
            Some(format!(
                "{{{}}}",
                children_ids_vec
                    .iter()
                    .map(|child_idx| temp_nodes[*child_idx].id.clone())
                    .collect::<Vec<String>>()
                    .join(",")
            ))
        };

        results.push(ProcessedKrakenUniqReport {
            id: node.id.clone(),
            percentage: node.percentage,
            reads: node.reads.clone(),
            tax_reads: node.tax_reads.clone(),
            kmers: node.kmers.clone(),
            duplication: node.duplication.clone(),
            coverage: node.coverage.clone(),
            tax_id: node.tax_id,
            rank: node.rank.to_ascii_lowercase().clone(),
            tax_name: node.tax_name.clone(),
            parent_id,
            children_ids: children_ids_str,
            processed_data_id: processed_data_id.to_string(),
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            sample_id: sample_id.to_string(),

            // Pass along the newly computed e_score
            e_score: node.e_score,
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A basic test to ensure the parse_kraken_uniq_report function
    /// correctly parses a small synthetic KrakenUniq report.
    #[test]
    fn test_parse_kraken_uniq_report_basic() {
        // A minimal "mock" KrakenUniq report:
        //   - First line is the header (which we skip).
        //   - Followed by a couple lines of actual data.
        let test_report = "# KrakenUniq v1.0.4 DATE:2024-12-23T22:12:18Z DB:./DB DB_SIZE:308153560 WD:/Users/nik/Desktop
# CL:/usr/local/bin/krakenuniq --db ./DB --thread 10 --exact --output out.txt --report report.txt --preload ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_0.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_1.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_10.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_100.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_101.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_102.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_103.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_104.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_105.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_106.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_107.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_108.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_109.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_11.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_110.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_111.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_112.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_113.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_114.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_115.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_116.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_117.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_118.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_119.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_12.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_120.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_121.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_122.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_123.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_124.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_125.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_126.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_127.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_128.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_129.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_13.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_130.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_131.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_132.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_133.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_134.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_135.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_136.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_137.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_138.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_139.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_14.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_140.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_141.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_142.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_143.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_144.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_145.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_146.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_147.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_148.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_149.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_15.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_150.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_151.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_152.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_153.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_154.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_155.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_156.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_157.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_158.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_159.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_16.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_160.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_161.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_162.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_163.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_164.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_165.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_166.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_167.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_168.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_169.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_17.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_170.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_171.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_172.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_173.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_174.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_175.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_176.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_177.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_178.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_179.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_18.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_180.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_181.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_182.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_183.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_184.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_185.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_186.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_187.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_188.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_189.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_19.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_190.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_191.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_192.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_193.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_194.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_195.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_196.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_197.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_198.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_199.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_2.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_20.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_200.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_201.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_202.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_203.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_204.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_205.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_206.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_207.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_208.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_209.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_21.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_210.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_211.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_212.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_213.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_214.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_215.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_22.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_23.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_24.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_25.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_26.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_27.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_28.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_29.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_3.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_30.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_31.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_32.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_33.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_34.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_35.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_36.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_37.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_38.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_39.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_4.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_40.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_41.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_42.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_43.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_44.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_45.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_46.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_47.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_48.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_49.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_5.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_50.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_51.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_52.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_53.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_54.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_55.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_56.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_57.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_58.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_59.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_6.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_60.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_61.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_62.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_63.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_64.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_65.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_66.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_67.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_68.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_69.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_7.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_70.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_71.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_72.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_73.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_74.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_75.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_76.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_77.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_78.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_79.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_80.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_81.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_82.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_83.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_84.fastq.gz ./supabase-files-3/AUD588_pass_barcode07_9277dd32_de38319c_85.fastq.gz
%	reads	taxReads	kmers	dup	cov	taxID	rank	taxName
0.01415	3	3	4985771	2.65	NA	0	no rank	unclassified
99.99	21199	0	158643	170	0.006178	1	root	Root
99.99	21199	204	158643	170	0.006178	2	domain	  Eukaryota
94.14	19959	267	43387	27.2	0.009131	63799	supergroup	    TSAR
87.04	18454	179	27692	27.3	0.02459	70357	division	      Stramenopiles
82.34	17457	486	22455	28.5	0.03096	70766	subdivision	        Gyrista
65.24	13833	342	11995	36.9	0.1121	72453	class	          Mediophyceae
46.77	9916	280	6967	41.2	0.1885	72718	order	            Thalassiosirales
30.25	6414	67	4393	40.3	0.3128	72776	family	              Thalassiosiraceae
24.13	5115	187	3537	39	0.3379	72808	genus	                Thalassiosira
9.942	2108	99	1691	32.3	0.3936	72839	species	                  Thalassiosira_sp.
0.9575	203	0	124	45.7	0.7251	1000195682	assembly	                    clone_15H3Te91i
0.9575	203	203	124	45.7	0.7251	1000195683	sequence	                      JQ782071.1.1801_U
0.9197	195	0	80	68.2	0.7018	1000197942	assembly	                    clone_H3S3Be437
0.9197	195	195	80	68.2	0.7018	1000197943	sequence	                      JQ781889.1.1801_U
0.7971	169	0	142	34.2	0.8353	1000199194	assembly	                    clone_14H3Te6Kq
0.7971	169	169	142	34.2	0.8353	1000199195	sequence	                      JQ782060.1.1800_U
0.7263	154	0	80	28	0.4571	1000217430	assembly	                    clone_14H3Te6KV
0.7263	154	154	80	28	0.4571	1000217431	sequence	                      JQ782059.1.1799_U
0.6556	139	0	129	32.1	0.7457	1000254833	assembly	                    clone_SCM38C36
0.6556	139	139	129	32.1	0.7457	1000254834	sequence	                      AY665000.1.1757_U
0.5754	122	0	80	43.2	0.6202	1000211355	assembly	                    clone_15H3Te92u
0.5754	122	122	80	43.2	0.6202	1000211356	sequence	                      JQ782073.1.1801_U
0.5283	112	0	50	60.6	0.4348	1000285498	assembly	                    clone_14H3Te6L1
0.5283	112	112	50	60.6	0.4348	1000285499	sequence	                      JQ782061.1.1801_U
0.5235	111	0	63	46.8	0.7	1000245806	assembly	                    clone_H3S3Ae97A
0.5235	111	111	63	46.8	0.7	1000245807	sequence	                      JQ781886.1.1800_U
0.4858	103	0	57	48.4	1	1000005839	assembly	                    clone_15H3Te94A
0.4858	103	103	57	48.4	1	1000005840	sequence	                      JQ782074.1.1801_U
0.4386	93	0	43	47.8	0.3981	1000329170	assembly	                    strain_422A
0.4386	93	93	43	47.8	0.3981	1000329171	sequence	                      EU286784.1.521_U
0.316	67	0	50	36.3	0.5435	1000251131	assembly	                    clone_15H3Te915
0.316	67	67	50	36.3	0.5435	1000251132	sequence	                      JQ782069.1.1801_U
0.316	67	0	59	26.8	0.5	1000295338	assembly	                    strain_RCC4859
0.316	67	67	59	26.8	0.5	1000295339	sequence	                      KY094986.1.942_U
0.2688	57	0	37	44	0.8409	1000022127	assembly	                    clone_SGYI786
0.2688	57	57	37	44	0.8409	1000022128	sequence	                      KJ758234.1.1804_U
0.2547	54	0	28	58.8	1	1000015891	assembly	                    strain_RCC5327
0.2547	54	54	28	58.8	1	1000015892	sequence	                      MH764800.1.899_U
0.2405	51	0	23	63.6	0.6765	1000315121	assembly	                    clone_SGYI792
0.2405	51	51	23	63.6	0.6765	1000315122	sequence	                      KJ758236.1.1799_U
0.217	46	0	18	48.4	0.7826	1000191015	assembly	                    clone_15H3Te92Q
0.217	46	46	18	48.4	0.7826	1000191016	sequence	                      JQ782072.1.1800_U
0.2028	43	0	58	17.2	0.3314	1000291799	assembly	                    clone_70S1Ae4a5
0.2028	43	43	58	17.2	0.3314	1000291800	sequence	                      JQ782038.1.1800_U
0.1509	32	0	26	37.6	0.268	1000109226	assembly	                    clone_SGYI521
0.1509	32	32	26	37.6	0.268	1000109227	sequence	                      KJ758126.1.1801_U
0.1509	32	0	14	40.1	0.9333	1000267526	assembly	                    clone_15H3Te95B
0.1509	32	32	14	40.1	0.9333	1000267527	sequence	                      JQ782076.1.1801_U
0.1273	27	0	51	14	0.8095	1000103530	assembly	                    clone_AN0678L10
0.1273	27	27	51	14	0.8095	1000103531	sequence	                      JQ955990.1.981_U
0.1038	22	0	18	30.8	0.1364	1000115759	assembly	                    strain_RCC4791
0.1038	22	22	18	30.8	0.1364	1000115760	sequence	                      KY094992.1.938_U
0.08018	17	0	19	18.9	1	1000196478	assembly	                    clone_HL4SCM04.58
0.08018	17	17	19	18.9	1	1000196479	sequence	                      KC488606.1.1660_U
0.07075	15	0	63	5.95	0.3387	1000159186	assembly	                    strain_RCC4219
0.07075	15	15	63	5.95	0.3387	1000159187	sequence	                      MH792112.1.1641_U
0.07075	15	0	39	9.51	0.3362	1000004484	assembly	                    strain_RCC4220
0.07075	15	15	39	9.51	0.3362	1000004485	sequence	                      MH792113.1.1702_U
0.07075	15	0	5	62.6	0.1923	1000086591	assembly	                    strain_A13
0.07075	15	15	5	62.6	0.1923	1000086592	sequence	                      KJ671720.1.697_U
0.04717	10	0	35	8.74	0.3723	1000051978	assembly	                    clone_13H3Te9Yr
0.04717	10	10	35	8.74	0.3723	1000051979	sequence	                      JQ782058.1.1801_U
0.04245	9	0	76	5	0.3455	1000223255	assembly	                    clone_ME_Euk_DBT14
0.04245	9	9	76	5	0.3455	1000223256	sequence	                      GU385526.1.1714_U
0.04245	9	0	24	6.29	0.5333	1000007969	assembly	                    clone_SGYI1123
0.04245	9	9	24	6.29	0.5333	1000007970	sequence	                      KJ757839.1.1804_U
0.03773	8	0	25	13	0.2315	1000005800	assembly	                    clone_15H3Te95T
0.03773	8	8	25	13	0.2315	1000005801	sequence	                      JQ782077.1.1716_U
0.01887	4	0	1	123	1	1000258479	assembly	                    strain_SMS58
0.01887	4	4	1	123	1	1000258480	sequence	                      MT489371.1.1676_U
0.009433	2	0	24	3.04	1	1000193099	assembly	                    clone_SGYI1224
0.009433	2	2	24	3.04	1	1000193100	sequence	                      KJ757921.1.1802_U
0.009433	2	0	16	2.25	1	1000037547	assembly	                    strain_MBTD-CMFRI-S132
0.009433	2	2	16	2.25	1	1000037548	sequence	                      JF708182.1.583_U
0.009433	2	0	4	6	0.2105	1000127616	assembly	                    clone_AN0628L26
0.009433	2	2	4	6	0.2105	1000127617	sequence	                      JQ955950.1.992_U
0.004717	1	0	12	2.58	1	1000265428	assembly	                    clone_CB432L16
0.004717	1	1	12	2.58	1	1000265429	sequence	                      JQ956068.1.975_U
0.004717	1	0	1	8	0.01111	1000044303	assembly	                    clone_SGYI566
0.004717	1	1	1	8	0.01111	1000044304	sequence	                      KJ758143.1.1801_U
3.231	685	96	469	40.2	0.3964	72825	species	                  Thalassiosira_hispida
";

        // Call your parsing function.
        let result = parse_kraken_uniq_report(
            test_report,
            "proc123",
            "userABC",
            "orgXYZ",
            "sample999",
        )
            .expect("Parsing should succeed");

        // Check that we got the expected number of parsed rows.
        assert_eq!(
            result.len(),
            82,
            "Should parse 82 lines of data (including unclassified)."
        );

        // You can also check individual fields.
        // For example, row 0 is unclassified
        let row0 = &result[0];
        assert_eq!(
            row0.rank, "unclassified",
            "Row 0 should be unclassified by detection logic or rank='-'"
        );
        assert_eq!(row0.reads, "3");
        assert_eq!(row0.tax_id, 0);

        let row1 = &result[1];
        assert_eq!(row1.tax_name, "Root");
        assert_eq!(row1.tax_id, 1);
        println!("Row 1 percentage = {:#?}", row1);

        assert_eq!(row1.percentage, 99.99, "Percentage should be 99.99");

        // Depth-based parent/child relationships can also be tested.
        // For instance, 'Escherichia' (row2) might be a child of row1.
        println!("Parsed rows = {:#?}", result);
    }
}
