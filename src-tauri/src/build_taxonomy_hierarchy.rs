use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaxonomyNode {
    name: Arc<str>,
    tax_id: i64,
    rank: Arc<str>,
    percentage: f32,
    reads: i64,
    depth: i16,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    children: Vec<TaxonomyNode>,
}

#[command]
pub async fn build_taxonomy_hierarchy(
    nodes: Vec<TaxonomyNode>,
) -> Result<Vec<TaxonomyNode>, String> {
    println!("\n=== Starting Hierarchy Build ===");
    println!("Initial node count: {}", nodes.len());

    if nodes.is_empty() {
        return Ok(Vec::new());
    }

    let mut root_nodes: Vec<TaxonomyNode> = Vec::new();
    let mut stack: Vec<TaxonomyNode> = Vec::new();

    for mut node in nodes {
        // Initialize empty children vector
        node.children = Vec::new();

        // Adjust stack based on depth
        while let Some(last_node) = stack.last() {
            if last_node.depth >= node.depth {
                stack.pop();
            } else {
                break;
            }
        }

        if stack.is_empty() {
            // No parent, this is a root node
            root_nodes.push(node.clone());
        } else {
            // Add as a child to the last node in the stack
            if let Some(parent) = stack.last() {
                let parent_depth = parent.depth;
                let parent_name = Arc::clone(&parent.name);

                fn add_child_to_parent(
                    nodes: &mut Vec<TaxonomyNode>,
                    parent_depth: i16,
                    parent_name: Arc<str>,
                    child: TaxonomyNode,
                ) {
                    for node in nodes.iter_mut() {
                        if node.depth == parent_depth && node.name == parent_name {
                            node.children.push(child);
                            return;
                        }
                        if !node.children.is_empty() {
                            // We clone the parent_name here so that we don't lose ownership
                            let cloned_parent_name = Arc::clone(&parent_name);
                            add_child_to_parent(&mut node.children, parent_depth, cloned_parent_name, child.clone());
                        }
                    }
                }

                add_child_to_parent(&mut root_nodes, parent_depth, parent_name, node.clone());
            }
        }

        stack.push(node);
    }

    println!("Hierarchy building complete!");
    println!("Returning {} root nodes", root_nodes.len());

    Ok(root_nodes)
}

#[command]
pub async fn validate_taxonomy_hierarchy(nodes: Vec<TaxonomyNode>) -> Result<bool, String> {
    fn validate_node(node: &TaxonomyNode, parent_depth: i16) -> bool {
        if node.depth <= parent_depth {
            return false;
        }
        node.children
            .iter()
            .all(|child| validate_node(child, node.depth))
    }

    Ok(nodes
        .par_iter()
        .all(|root_node| validate_node(root_node, -1)))
}

#[command]
pub async fn get_hierarchy_stats(nodes: Vec<TaxonomyNode>) -> Result<HashMap<String, i64>, String> {
    let mut stats = HashMap::new();

    fn update_stats(node: &TaxonomyNode, stats: &mut HashMap<String, i64>) {
        *stats.entry("total_nodes".to_string()).or_insert(0) += 1;

        let rank_key = format!("rank_{}", node.rank.to_lowercase());
        *stats.entry(rank_key).or_insert(0) += 1;

        node.children
            .iter()
            .for_each(|child| update_stats(child, stats));
    }

    nodes.iter().for_each(|node| update_stats(node, &mut stats));
    Ok(stats)
}
